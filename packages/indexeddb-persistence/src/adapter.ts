import type { PersistedRecord, PersistenceAdapterStrategy, PersistenceStore } from '@marsa/core';
import { PersistenceStoreNameSchema } from '@marsa/core';

/**
 * @description
 * Configures the IndexedDB database used by the persistence adapter.
 * @docsPage core/persistence
 * @docsCategory Adapters
 */
export interface IndexedDBPersistenceOptions {
    /**
     * @description
     * Names the IndexedDB database; defaults to `marsa`.
     */
    readonly databaseName?: string;
    /**
     * @description
     * Names the existing backing object store for `application-state`; defaults to `records`.
     */
    readonly objectStoreName?: string;
    /**
     * @description
     * Sets the minimum database schema version; defaults to `1`.
     */
    readonly databaseVersion?: number;
    /**
     * @description
     * Supplies an alternate IndexedDB factory for non-window hosts and tests.
     */
    readonly indexedDB?: IDBFactory;
}

interface StoredRecord {
    readonly key: string;
    readonly schemaVersion: number;
    readonly value: unknown;
}

/**
 * @description
 * Persists versioned records in independently managed IndexedDB object stores.
 * @docsPage core/persistence
 * @docsCategory Adapters
 */
export class IndexedDBPersistenceAdapter implements PersistenceAdapterStrategy {
    private readonly databaseName: string;
    private readonly objectStoreName: string;
    private readonly databaseVersion: number;
    private readonly indexedDB: IDBFactory;
    private readonly stores = new Map<string, PersistenceStore>();
    private database: IDBDatabase | undefined;
    private databasePromise: Promise<IDBDatabase> | undefined;
    private operationTail: Promise<void> = Promise.resolve();
    private readonly operationErrors: unknown[] = [];

    /**
     * @description
     * Creates a lazy IndexedDB adapter. The browser API is looked up only when instantiated.
     * @param options Database name, minimum version, or an alternate IndexedDB factory.
     */
    constructor(options: IndexedDBPersistenceOptions = {}) {
        this.databaseName = options.databaseName ?? 'marsa';
        this.objectStoreName = options.objectStoreName ?? 'records';
        this.databaseVersion = options.databaseVersion ?? 1;
        const indexedDB = options.indexedDB ?? globalThis.indexedDB;

        if (typeof indexedDB === 'undefined') {
            throw new Error('IndexedDB is unavailable in this runtime.');
        }
        if (this.databaseName.trim().length === 0) {
            throw new Error('IndexedDB databaseName must not be empty.');
        }
        if (this.objectStoreName.trim().length === 0) {
            throw new Error('IndexedDB objectStoreName must not be empty.');
        }
        if (!Number.isSafeInteger(this.databaseVersion) || this.databaseVersion < 1) {
            throw new Error('IndexedDB databaseVersion must be a positive safe integer.');
        }

        this.indexedDB = indexedDB;
    }

    /**
     * @description
     * Returns a handle scoped to one named object store, creating that object store on first use.
     * @param name Non-empty purpose-specific store name.
     * @returns A scoped store handle.
     */
    store(name: string): PersistenceStore {
        const parsedName = PersistenceStoreNameSchema.safeParse(name);
        if (!parsedName.success) {
            throw new Error(
                parsedName.error.issues[0]?.message ?? 'Persistence store name must not be empty.',
            );
        }

        const existing = this.stores.get(name);
        if (existing) {
            return existing;
        }

        const scopedStore: PersistenceStore = {
            read: key => this.enqueue(() => this.read(name, key)),
            write: (key, record) => this.enqueue(() => this.write(name, key, record)),
            delete: key => this.enqueue(() => this.delete(name, key)),
            entries: () => this.enqueue(() => this.entries(name)),
        };
        this.stores.set(name, scopedStore);
        return scopedStore;
    }

    /**
     * @description
     * Waits for every operation queued before this call to complete.
     * @returns Resolves after queued operations settle.
     * @throws Rejects with one error or an aggregate when queued operations failed.
     */
    async flush(): Promise<void> {
        await this.operationTail;
        const errors = this.operationErrors.splice(0);
        if (errors.length === 1) {
            throw errors[0];
        }
        if (errors.length > 1) {
            throw new AggregateError(errors, `IndexedDB operations failed for "${this.databaseName}".`);
        }
    }

    /**
     * @description
     * Closes the connection. The adapter will reopen it on its next operation.
     * @returns Resolves after queued operations complete and the connection closes.
     * @throws Rejects after closing the connection if queued operations failed.
     */
    async close(): Promise<void> {
        let flushFailed = false;
        let flushError: unknown;
        try {
            await this.flush();
        } catch (error) {
            flushFailed = true;
            flushError = error;
        }
        this.database?.close();
        this.database = undefined;
        this.databasePromise = undefined;
        if (flushFailed) {
            throw flushError;
        }
    }

    private read(storeName: string, key: string): Promise<PersistedRecord | undefined> {
        assertKey(key);
        return this.runTransaction(this.physicalStoreName(storeName), 'readonly', store =>
            store.get(key),
        ).then(result => {
            if (result === undefined) {
                return undefined;
            }
            return parseStoredRecord(key, result);
        });
    }

    private write(storeName: string, key: string, record: PersistedRecord): Promise<void> {
        assertKey(key);
        assertSchemaVersion(record.schemaVersion);
        return this.runTransaction(this.physicalStoreName(storeName), 'readwrite', store =>
            store.put({
                key,
                schemaVersion: record.schemaVersion,
                value: record.value,
            } satisfies StoredRecord),
        ).then(() => undefined);
    }

    private delete(storeName: string, key: string): Promise<void> {
        assertKey(key);
        return this.runTransaction(this.physicalStoreName(storeName), 'readwrite', store =>
            store.delete(key),
        ).then(() => undefined);
    }

    private entries(storeName: string): Promise<readonly (readonly [string, PersistedRecord])[]> {
        return this.runTransaction<StoredRecord[]>(this.physicalStoreName(storeName), 'readonly', store =>
            store.getAll(),
        ).then(records =>
            records.map(record => [record.key, parseStoredRecord(record.key, record)] as const),
        );
    }

    private physicalStoreName(storeName: string): string {
        if (storeName === 'application-state') {
            return this.objectStoreName;
        }

        const physicalName = `marsa-purpose-${encodeURIComponent(storeName)}`;
        if (physicalName === this.objectStoreName) {
            throw new Error(
                `Persistence store "${storeName}" conflicts with the configured application-state object store.`,
            );
        }
        return physicalName;
    }

    private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
        const result = this.operationTail.then(operation);
        this.operationTail = result.then(
            () => undefined,
            error => {
                this.operationErrors.push(error);
            },
        );
        return result;
    }

    private runTransaction<Result>(
        storeName: string,
        mode: IDBTransactionMode,
        createRequest: (store: IDBObjectStore) => IDBRequest<Result>,
    ): Promise<Result> {
        return new Promise((resolve, reject) => {
            let settled = false;
            let requestResult: { readonly value: Result } | undefined;
            const fail = (error: unknown): void => {
                if (!settled) {
                    settled = true;
                    reject(error);
                }
            };

            void this.ensureObjectStore(storeName).then(database => {
                if (settled) {
                    return;
                }

                let transaction: IDBTransaction;
                let request: IDBRequest<Result>;
                try {
                    transaction = database.transaction(storeName, mode);
                    request = createRequest(transaction.objectStore(storeName));
                } catch (error) {
                    fail(error);
                    return;
                }

                request.onsuccess = () => {
                    requestResult = { value: request.result };
                };
                request.onerror = () => {
                    fail(request.error ?? new Error(`IndexedDB request failed for "${this.databaseName}".`));
                };
                transaction.oncomplete = () => {
                    if (!requestResult) {
                        fail(
                            new Error(
                                `IndexedDB transaction completed without a result for "${this.databaseName}".`,
                            ),
                        );
                        return;
                    }
                    settled = true;
                    resolve(requestResult.value);
                };
                transaction.onabort = () => {
                    fail(
                        transaction.error ??
                            request.error ??
                            new Error(`IndexedDB transaction aborted for "${this.databaseName}".`),
                    );
                };
                transaction.onerror = () => {
                    fail(
                        transaction.error ??
                            request.error ??
                            new Error(`IndexedDB transaction failed for "${this.databaseName}".`),
                    );
                };
            }, fail);
        });
    }

    private async ensureObjectStore(storeName: string): Promise<IDBDatabase> {
        let database = await this.openDatabase();
        if (database.objectStoreNames.contains(storeName)) {
            return database;
        }

        if (!Number.isSafeInteger(database.version + 1)) {
            throw new Error(`IndexedDB database "${this.databaseName}" cannot be upgraded further.`);
        }

        try {
            database = await this.upgradeDatabase(database, database.version + 1, storeName);
        } catch (error) {
            if (!isVersionError(error)) {
                throw error;
            }
            database = await this.requestDatabase();
            this.setDatabase(database);
            if (!database.objectStoreNames.contains(storeName)) {
                database = await this.upgradeDatabase(database, database.version + 1, storeName);
            }
        }

        if (!database.objectStoreNames.contains(storeName)) {
            throw new Error(`IndexedDB store "${storeName}" was not created.`);
        }
        return database;
    }

    private openDatabase(): Promise<IDBDatabase> {
        if (this.database) {
            return Promise.resolve(this.database);
        }
        if (this.databasePromise) {
            return this.databasePromise;
        }

        const opening = this.requestDatabase().then(database => {
            if (database.version >= this.databaseVersion) {
                return database;
            }
            return this.upgradeDatabase(database, this.databaseVersion);
        });

        this.databasePromise = opening;
        void opening.catch(() => {
            if (this.databasePromise === opening) {
                this.databasePromise = undefined;
            }
        });
        return opening;
    }

    private upgradeDatabase(
        database: IDBDatabase,
        version: number,
        storeName?: string,
    ): Promise<IDBDatabase> {
        database.close();
        if (this.database === database) {
            this.database = undefined;
        }
        this.databasePromise = undefined;

        return this.requestDatabase(version, storeName);
    }

    private requestDatabase(version?: number, storeName?: string): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const request =
                version === undefined
                    ? this.indexedDB.open(this.databaseName)
                    : this.indexedDB.open(this.databaseName, version);
            request.onupgradeneeded = () => {
                if (storeName && !request.result.objectStoreNames.contains(storeName)) {
                    request.result.createObjectStore(storeName, { keyPath: 'key' });
                }
            };
            request.onerror = () => {
                if (!settled) {
                    settled = true;
                    reject(
                        request.error ??
                            new Error(`Failed to open IndexedDB database "${this.databaseName}".`),
                    );
                }
            };
            request.onblocked = () => {
                if (!settled) {
                    settled = true;
                    reject(
                        new Error(
                            `Opening IndexedDB database "${this.databaseName}" is blocked by another connection.`,
                        ),
                    );
                }
            };
            request.onsuccess = () => {
                const database = request.result;
                if (settled) {
                    database.close();
                    return;
                }
                settled = true;
                this.setDatabase(database);
                resolve(database);
            };
        });
    }

    private setDatabase(database: IDBDatabase): void {
        this.database = database;
        database.onversionchange = () => {
            database.close();
            if (this.database === database) {
                this.database = undefined;
                this.databasePromise = undefined;
            }
        };
    }
}

function assertKey(key: string): void {
    if (key.trim().length === 0) {
        throw new Error('Persistence key must not be empty.');
    }
}

function assertSchemaVersion(schemaVersion: number): void {
    if (!Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
        throw new Error('Persisted schemaVersion must be a positive safe integer.');
    }
}

function parseStoredRecord(key: string, value: unknown): PersistedRecord {
    if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || !('value' in value)) {
        throw new Error(`IndexedDB record "${key}" has an invalid shape.`);
    }

    const schemaVersion = value.schemaVersion;
    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion) || schemaVersion < 1) {
        throw new Error(`IndexedDB record "${key}" has an invalid schema version.`);
    }

    return { schemaVersion, value: value.value };
}

function isVersionError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'name' in error && error.name === 'VersionError';
}
