import { MarsaError, type MarsaErrorCode } from '../common/errors/errors.js';
import { assertValidInput } from '../common/helpers/validation.js';
import { ConfigService } from '../config/config.service.js';
import { MemoryPersistenceAdapterStrategy } from '../config/persistence/memory-persistence-adapter.strategy.js';
import type {
    PersistenceAdapterStrategy,
    PersistenceStore,
} from '../config/persistence/persistence-adapter.contract.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import {
    ErrorReportingService,
    ReportServiceErrors,
    RuntimeErrorReporter,
} from '../runtime-error-manager/error-reporting.service.js';
import type { PersistedRecord } from '../schemas/persistence.js';
import {
    PersistedRecordSchema,
    PersistenceStoreNameSchema,
    PersistenceStoreSchema,
    StateMigrationSchema,
    StateServiceConstructionSchema,
    StateWriteOptionsSchema,
    type StateMigration,
    type StatePersistenceFailure,
    type StateServiceOptions,
    type StateWriteOptions,
} from '../schemas/persistence.js';
import type { StateCollection, StateCollectionOptions } from './state.contract.js';

interface CollectionRuntime {
    readonly name: string;
    readonly store: PersistenceStore;
    readonly adapter: PersistenceAdapterStrategy;
    readonly memory: Map<string, PersistedRecord>;
    readonly durableKeys: Set<string>;
    readonly keys: Set<string>;
    readonly collection: StateCollection<unknown>;
}

interface PendingWrite {
    readonly id: string;
    readonly collection: CollectionRuntime;
    readonly key: string;
    readonly record: PersistedRecord;
    readonly timer: ReturnType<typeof setTimeout>;
    readonly waiters: Array<{ readonly resolve: () => void; readonly reject: (error: unknown) => void }>;
}

interface StoredState {
    readonly __marsaStateStore: 1;
    readonly durable: boolean;
    readonly value: unknown;
}

/**
 * @description
 * Provides generic versioned state collections with configurable persistence, migrations, and flushing.
 * @docsPage core/state
 * @docsCategory Services
 */
@Injectable()
@ReportServiceErrors({ category: 'integration' })
export class StateService extends ErrorReportingService {
    private readonly adapter: PersistenceAdapterStrategy;
    private readonly collections = new Map<string, CollectionRuntime>();
    private readonly pendingWrites = new Map<string, PendingWrite>();
    private readonly inFlightWrites = new Map<string, Set<Promise<void>>>();
    private readonly migrations = new Map<number, (value: unknown) => unknown>();
    private readonly defaultSchemaVersion: number;
    private readonly defaultDebounceMs: number;
    private readonly persistenceEnabled: boolean;
    private readonly errorHandler: StateServiceOptions['onPersistenceError'];
    private readonly memoryAdapter = new MemoryPersistenceAdapterStrategy();

    /**
     * @description
     * Creates a state service from the active config's persistence and state options.
     * @param errorReporter Reports service failures to the runtime error manager.
     * @param configService Provides the configured adapter and generic state defaults.
     * @throws {MarsaError} If state configuration is invalid.
     */
    constructor(errorReporter: RuntimeErrorReporter, configService: ConfigService) {
        super(errorReporter);
        const options = configService.stateOptions;
        this.persistenceEnabled = options.persistenceEnabled;
        this.adapter = configService.persistenceOptions.adapter;
        this.defaultSchemaVersion = options.schemaVersion;
        this.defaultDebounceMs = options.debounceMs;
        this.errorHandler = options.onPersistenceError;

        assertValidInput(
            StateServiceConstructionSchema,
            {
                adapter: this.adapter,
                defaultSchemaVersion: this.defaultSchemaVersion,
                defaultDebounceMs: this.defaultDebounceMs,
                migrations: options.migrations,
                options: this.errorHandler ? { onPersistenceError: this.errorHandler } : {},
            },
            'INVALID_STATE_CONFIGURATION',
            'State service configuration',
        );
        for (const migration of options.migrations) {
            this.registerMigration(migration);
        }
    }

    /**
     * @description
     * Opens a generic named state collection.
     * @param name Caller-defined collection name.
     * @param options Optional persistence override for this collection.
     * @returns A reusable collection handle for opaque, versioned values.
     * @throws {MarsaError} If the collection name or adapter store is invalid.
     */
    collection<Value = unknown>(name: string, options: StateCollectionOptions = {}): StateCollection<Value> {
        const parsedName = PersistenceStoreNameSchema.safeParse(name);
        if (!parsedName.success) {
            throw new MarsaError(
                'INVALID_STATE_CONFIGURATION',
                parsedName.error.issues[0]?.message ?? 'State collection name must not be empty.',
                { cause: parsedName.error },
            );
        }

        const persistenceEnabled = options.persistenceEnabled ?? this.persistenceEnabled;
        const existing = this.collections.get(name);
        if (existing) {
            if (existing.adapter !== this.adapterFor(persistenceEnabled)) {
                throw new MarsaError(
                    'INVALID_STATE_CONFIGURATION',
                    `State collection "${name}" was already opened with different persistence settings.`,
                );
            }
            return existing.collection as StateCollection<Value>;
        }

        const adapter = this.adapterFor(persistenceEnabled);
        const store = adapter.store(name);
        const parsedStore = PersistenceStoreSchema.safeParse(store);
        if (!parsedStore.success) {
            throw new MarsaError(
                'INVALID_PERSISTENCE_ADAPTER',
                `State collection "${name}" is not backed by a valid persistence store.`,
                { cause: parsedStore.error },
            );
        }

        const runtime: CollectionRuntime = {
            name,
            store,
            adapter,
            memory: new Map(),
            durableKeys: new Set(),
            keys: new Set(),
            get collection() {
                return collection;
            },
        };
        const collection: StateCollection<unknown> = {
            read: key => this.read(runtime, key),
            write: (key, value, writeOptions) => this.write(runtime, key, value, writeOptions),
            delete: key => this.delete(runtime, key),
            entries: () => this.entries(runtime),
            release: key => this.release(runtime, key),
            flush: () => this.flushCollection(runtime),
        };
        this.collections.set(name, runtime);
        return runtime.collection as StateCollection<Value>;
    }

    /**
     * @description
     * Registers an adjacent schema migration shared by values in all collections.
     * @param migration Source and target schema versions with a transformation.
     * @throws {RangeError} If versions are invalid, non-adjacent, or already registered.
     */
    registerMigration(migration: StateMigration<unknown>): void {
        assertValidInput(StateMigrationSchema, migration, 'INVALID_STATE_CONFIGURATION', 'State migration');
        assertPositiveInteger(migration.fromVersion, 'migration.fromVersion');
        assertPositiveInteger(migration.toVersion, 'migration.toVersion');
        if (migration.toVersion !== migration.fromVersion + 1) {
            throw new RangeError('State migrations must advance exactly one schema version.');
        }
        if (this.migrations.has(migration.fromVersion)) {
            throw new RangeError(
                `A migration from schema version ${migration.fromVersion} is already registered.`,
            );
        }
        this.migrations.set(migration.fromVersion, migration.migrate);
    }

    /**
     * @description
     * Flushes all scheduled writes across every opened collection.
     * @throws An aggregate error when one or more writes fail.
     */
    async flush(): Promise<void> {
        await this.flushPending([...new Set([...this.pendingWrites.keys(), ...this.inFlightWrites.keys()])]);
        const adapters = new Set([...this.collections.values()].map(collection => collection.adapter));
        const failures: unknown[] = [];
        for (const adapter of adapters) {
            try {
                await adapter.flush();
            } catch (error) {
                failures.push(error);
            }
        }
        throwFailures(failures, 'One or more state collections could not be flushed.');
    }

    /**
     * @description
     * Flushes writes and releases collection handles, allowing pending timers to settle.
     * @throws Rejects when a pending state write cannot be committed.
     */
    async dispose(): Promise<void> {
        await this.flush();
        this.collections.clear();
    }

    private adapterFor(persistenceEnabled: boolean): PersistenceAdapterStrategy {
        return this.persistenceEnabled && persistenceEnabled ? this.adapter : this.memoryAdapter;
    }

    private async read<Value>(
        collection: CollectionRuntime,
        key: string,
    ): Promise<PersistedRecord<Value> | undefined> {
        assertKey(key);
        const cached = collection.memory.get(key);
        if (cached) {
            return cached as PersistedRecord<Value>;
        }

        let stored: PersistedRecord | undefined;
        try {
            stored = await collection.store.read(key);
            if (stored !== undefined) {
                assertValidInput(
                    PersistedRecordSchema,
                    stored,
                    'PERSISTENCE_READ_FAILED',
                    'Persisted state record',
                );
            }
        } catch (error) {
            throw this.reportFailure(error, 'read', collection.name, key);
        }
        if (!stored) {
            return undefined;
        }

        const decoded = decodeState(stored);
        if (decoded.durable) {
            collection.durableKeys.add(key);
        }
        let migrated: PersistedRecord<Value>;
        try {
            migrated = applyMigrations(decoded.record, this.defaultSchemaVersion, this.migrations);
        } catch (error) {
            throw this.reportFailure(error, 'migration', collection.name, key);
        }
        collection.memory.set(key, migrated);
        collection.keys.add(key);
        if (migrated.schemaVersion !== stored.schemaVersion || !decoded.enveloped) {
            try {
                await collection.store.write(key, encodeState(migrated, decoded.durable));
                await collection.adapter.flush();
            } catch (error) {
                throw this.reportFailure(error, 'migration', collection.name, key);
            }
        }
        return migrated;
    }

    private async write<Value>(
        collection: CollectionRuntime,
        key: string,
        value: Value,
        options: StateWriteOptions = {},
    ): Promise<void> {
        assertKey(key);
        assertValidInput(
            StateWriteOptionsSchema,
            options,
            'INVALID_STATE_CONFIGURATION',
            'State write options',
        );
        const schemaVersion = options.schemaVersion ?? this.defaultSchemaVersion;
        assertPositiveInteger(schemaVersion, 'schemaVersion');
        if (schemaVersion > this.defaultSchemaVersion) {
            throw new RangeError('schemaVersion cannot exceed the configured current schema version.');
        }
        const delayMs = options.debounceMs ?? this.defaultDebounceMs;
        assertNonNegativeInteger(delayMs, 'debounceMs');
        const durable = options.durable ?? collection.durableKeys.has(key);
        if (durable) {
            collection.durableKeys.add(key);
        } else {
            collection.durableKeys.delete(key);
        }
        const record = encodeState({ schemaVersion, value }, durable);
        collection.memory.set(key, { schemaVersion, value });
        collection.keys.add(key);
        const id = stateKey(collection.name, key);

        return new Promise<void>((resolve, reject) => {
            const existing = this.pendingWrites.get(id);
            if (existing) {
                clearTimeout(existing.timer);
            }
            const waiters = existing?.waiters ?? [];
            waiters.push({ resolve, reject });
            const timer = setTimeout(
                () => {
                    void this.flushPending([id]).catch(() => undefined);
                },
                options.immediate === true ? 0 : delayMs,
            );
            this.pendingWrites.set(id, { id, collection, key, record, timer, waiters });
            if (options.immediate === true) {
                clearTimeout(timer);
                void this.flushPending([id]).catch(() => undefined);
            }
        });
    }

    private async delete(collection: CollectionRuntime, key: string): Promise<void> {
        assertKey(key);
        const id = stateKey(collection.name, key);
        await this.flushPending([id]);
        try {
            await collection.store.delete(key);
            await collection.adapter.flush();
        } catch (error) {
            throw this.reportFailure(error, 'delete', collection.name, key);
        }
        collection.memory.delete(key);
        collection.durableKeys.delete(key);
        collection.keys.delete(key);
    }

    private async entries<Value>(
        collection: CollectionRuntime,
    ): Promise<readonly (readonly [string, PersistedRecord<Value>])[]> {
        let stored: readonly (readonly [string, PersistedRecord])[];
        try {
            stored = await collection.store.entries();
        } catch (error) {
            throw this.reportFailure(error, 'read', collection.name, '*');
        }
        for (const [key] of stored) {
            collection.keys.add(key);
        }
        const records: Array<readonly [string, PersistedRecord<Value>]> = [];
        for (const key of collection.keys) {
            const record = await this.read<Value>(collection, key);
            if (record) {
                records.push([key, record]);
            }
        }
        return records;
    }

    private async release(collection: CollectionRuntime, key: string): Promise<void> {
        assertKey(key);
        const id = stateKey(collection.name, key);
        await this.flushPending([id]);
        let durable = collection.durableKeys.has(key);
        if (!durable) {
            const record = await this.read(collection, key);
            durable = record ? decodeState(record).durable : false;
        }
        collection.memory.delete(key);
        if (durable) {
            return;
        }
        await this.delete(collection, key);
    }

    private async flushCollection(collection: CollectionRuntime): Promise<void> {
        const prefix = JSON.stringify([collection.name]).slice(0, -1) + ',';
        const keys = [...new Set([...this.pendingWrites.keys(), ...this.inFlightWrites.keys()])].filter(id =>
            id.startsWith(prefix),
        );
        await this.flushPending(keys);
        try {
            await collection.adapter.flush();
        } catch (error) {
            throw this.reportFailure(error, 'flush', collection.name, '*');
        }
    }

    private async flushPending(ids: readonly string[]): Promise<void> {
        const selected = ids.flatMap(id => {
            const pending = this.pendingWrites.get(id);
            if (!pending) {
                return [];
            }
            clearTimeout(pending.timer);
            this.pendingWrites.delete(id);
            return [pending];
        });
        const inFlight = new Set(ids.flatMap(id => [...(this.inFlightWrites.get(id) ?? [])]));
        if (selected.length === 0) {
            await Promise.all(inFlight);
            return;
        }

        const commits = new Map<CollectionRuntime, PendingWrite[]>();
        for (const pending of selected) {
            const writes = commits.get(pending.collection) ?? [];
            writes.push(pending);
            commits.set(pending.collection, writes);
        }
        const promises = [...commits].map(([collection, writes]) => this.commitPending(collection, writes));
        for (const [index, [, writes]] of [...commits].entries()) {
            for (const pending of writes) {
                const pendingWrites = this.inFlightWrites.get(pending.id) ?? new Set<Promise<void>>();
                pendingWrites.add(promises[index]!);
                this.inFlightWrites.set(pending.id, pendingWrites);
            }
        }

        try {
            await Promise.all([...inFlight, ...promises]);
        } finally {
            for (const pending of selected) {
                const writes = this.inFlightWrites.get(pending.id);
                for (const promise of promises) {
                    writes?.delete(promise);
                }
                if (writes?.size === 0) {
                    this.inFlightWrites.delete(pending.id);
                }
            }
        }
    }

    private async commitPending(
        collection: CollectionRuntime,
        selected: readonly PendingWrite[],
    ): Promise<void> {
        const failures = new Map<string, unknown>();
        await Promise.all(
            selected.map(async pending => {
                try {
                    await collection.store.write(pending.key, pending.record);
                } catch (error) {
                    failures.set(
                        pending.key,
                        this.reportFailure(error, 'write', collection.name, pending.key),
                    );
                }
            }),
        );
        try {
            await collection.adapter.flush();
        } catch (error) {
            for (const pending of selected) {
                if (!failures.has(pending.key)) {
                    failures.set(
                        pending.key,
                        this.reportFailure(error, 'flush', collection.name, pending.key),
                    );
                }
            }
        }
        for (const pending of selected) {
            const error = failures.get(pending.key);
            if (error === undefined) {
                for (const waiter of pending.waiters) {
                    waiter.resolve();
                }
            } else {
                for (const waiter of pending.waiters) {
                    waiter.reject(error);
                }
            }
        }
        throwFailures([...failures.values()], 'One or more state writes failed.');
    }

    private reportFailure(
        error: unknown,
        operation: StatePersistenceFailure['operation'],
        collection: string,
        key: string,
    ): unknown {
        const failure = new MarsaError(
            persistenceErrorCode(operation),
            `State ${operation} failed for collection "${collection}".`,
            { cause: error },
        );
        if (!this.errorHandler) {
            return failure;
        }
        try {
            this.errorHandler({ operation, collection, key, error: failure });
        } catch (reportingError) {
            return new AggregateError(
                [failure, reportingError],
                'State persistence failed and its error handler also failed.',
            );
        }
        return failure;
    }
}

function persistenceErrorCode(
    operation: StatePersistenceFailure['operation'],
): Extract<MarsaErrorCode, `PERSISTENCE_${string}`> {
    switch (operation) {
        case 'read':
            return 'PERSISTENCE_READ_FAILED';
        case 'write':
            return 'PERSISTENCE_WRITE_FAILED';
        case 'delete':
            return 'PERSISTENCE_DELETE_FAILED';
        case 'flush':
            return 'PERSISTENCE_FLUSH_FAILED';
        case 'migration':
            return 'PERSISTENCE_MIGRATION_FAILED';
    }
}

function encodeState<Value>(record: PersistedRecord<Value>, durable: boolean): PersistedRecord<StoredState> {
    return {
        schemaVersion: record.schemaVersion,
        value: { __marsaStateStore: 1, durable, value: record.value },
    };
}

function decodeState(record: PersistedRecord): {
    readonly record: PersistedRecord;
    readonly durable: boolean;
    readonly enveloped: boolean;
} {
    const value = record.value;
    if (
        typeof value === 'object' &&
        value !== null &&
        '__marsaStateStore' in value &&
        value.__marsaStateStore === 1 &&
        'durable' in value &&
        typeof value.durable === 'boolean' &&
        'value' in value
    ) {
        return {
            record: { schemaVersion: record.schemaVersion, value: value.value },
            durable: value.durable,
            enveloped: true,
        };
    }
    return { record, durable: false, enveloped: false };
}

function applyMigrations<Value>(
    record: PersistedRecord,
    currentVersion: number,
    migrations: Map<number, (value: unknown) => unknown>,
): PersistedRecord<Value> {
    if (!Number.isSafeInteger(record.schemaVersion) || record.schemaVersion < 1) {
        throw new MarsaError('PERSISTENCE_MIGRATION_FAILED', 'Stored state has an invalid schema version.');
    }
    if (record.schemaVersion > currentVersion) {
        throw new MarsaError(
            'PERSISTENCE_MIGRATION_FAILED',
            `Stored schema version ${record.schemaVersion} is newer than supported version ${currentVersion}.`,
        );
    }
    let value = record.value;
    for (let version = record.schemaVersion; version < currentVersion; version += 1) {
        const migration = migrations.get(version);
        if (!migration) {
            throw new MarsaError(
                'PERSISTENCE_MIGRATION_FAILED',
                `Missing migration from schema version ${version} to ${version + 1}.`,
            );
        }
        try {
            value = migration(value);
        } catch (error) {
            throw new MarsaError(
                'PERSISTENCE_MIGRATION_FAILED',
                `Migration from schema version ${version} to ${version + 1} failed.`,
                { cause: error },
            );
        }
    }
    return { schemaVersion: currentVersion, value: value as Value };
}

function stateKey(collection: string, key: string): string {
    return JSON.stringify([collection, key]);
}

function assertKey(key: string): void {
    if (typeof key !== 'string' || key.trim().length === 0) {
        throw new MarsaError('INVALID_STATE_CONFIGURATION', 'State collection keys must not be empty.');
    }
}

function assertPositiveInteger(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(`${name} must be a positive safe integer.`);
    }
}

function assertNonNegativeInteger(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer.`);
    }
}

function throwFailures(failures: readonly unknown[], message: string): void {
    if (failures.length === 1) {
        throw failures[0];
    }
    if (failures.length > 1) {
        throw new AggregateError(failures, message);
    }
}
