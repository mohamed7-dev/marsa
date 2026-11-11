import { z } from 'zod';
import type {
    PersistenceAdapterStrategy,
    PersistenceStore,
} from '../config/persistence/persistence-adapter.contract.js';

export const PersistedRecordSchema = z
    .object({
        schemaVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
        value: z.unknown(),
    })
    .strict()
    .readonly();

export type PersistedRecord<Value = unknown> = Omit<z.infer<typeof PersistedRecordSchema>, 'value'> & {
    readonly value: Value;
};

/**
 * @description
 * Validates a store key paired with its versioned persisted record.
 * @docsPage core/persistence
 * @docsCategory Contracts
 */
export const PersistedRecordEntrySchema = z.tuple([z.string().min(1), PersistedRecordSchema]).readonly();

/**
 * @description
 * Identifies one record in a named persistence store.
 * @docsPage core/persistence
 * @docsCategory Types
 */
export type PersistedRecordEntry = z.infer<typeof PersistedRecordEntrySchema>;

/**
 * @description
 * Validates non-empty names used to create purpose-specific persistence stores.
 * @docsPage core/persistence
 * @docsCategory Contracts
 */
export const PersistenceStoreNameSchema = z
    .string()
    .refine(name => name.trim().length > 0, 'Persistence store name must not be empty.')
    .readonly();

export const PersistenceStoreSchema = z.custom<PersistenceStore>(
    value =>
        typeof value === 'object' &&
        value !== null &&
        'read' in value &&
        typeof value.read === 'function' &&
        'write' in value &&
        typeof value.write === 'function' &&
        'delete' in value &&
        typeof value.delete === 'function' &&
        'entries' in value &&
        typeof value.entries === 'function',
    { message: 'Expected a persistence store implementing read, write, delete, and entries.' },
);

export const PersistenceAdapterSchema = z.custom<PersistenceAdapterStrategy>(
    value =>
        typeof value === 'object' &&
        value !== null &&
        'store' in value &&
        typeof value.store === 'function' &&
        'flush' in value &&
        typeof value.flush === 'function',
    { message: 'Expected a persistence adapter implementing store and flush.' },
);

export const StateWriteOptionsSchema = z
    .object({
        schemaVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
        durable: z.boolean().optional(),
        debounceMs: z.number().min(0).optional(),
        immediate: z.boolean().optional(),
    })
    .strict()
    .readonly();

export const StateMigrationSchema = z
    .object({
        fromVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
        toVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
        migrate: z.custom<(value: unknown) => unknown>(value => typeof value === 'function'),
    })
    .strict()
    .readonly();

export const StatePersistenceFailureSchema = z
    .object({
        operation: z.enum(['read', 'write', 'delete', 'flush', 'migration']),
        collection: PersistenceStoreNameSchema,
        key: z.string().min(1),
        error: z.unknown(),
    })
    .strict()
    .readonly();

export const StateServiceOptionsSchema = z
    .object({
        onPersistenceError: z
            .custom<(failure: z.infer<typeof StatePersistenceFailureSchema>) => void>(
                value => typeof value === 'function',
            )
            .optional(),
    })
    .strict()
    .readonly();

export const StateServiceConstructionSchema = z
    .object({
        adapter: PersistenceAdapterSchema,
        defaultSchemaVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
        defaultDebounceMs: z.number().min(0),
        migrations: z.array(StateMigrationSchema).readonly(),
        options: StateServiceOptionsSchema,
    })
    .strict();

/**
 * @description
 * Controls versioning, durability, and scheduling for a state write.
 * @docsPage core/state
 * @docsCategory Types
 */
export type StateWriteOptions = z.infer<typeof StateWriteOptionsSchema>;

/**
 * @description
 * Defines one adjacent schema-version transformation for values in any state collection.
 * @docsPage core/state
 * @docsCategory Types
 */
export type StateMigration<Value = unknown> = Omit<z.infer<typeof StateMigrationSchema>, 'migrate'> & {
    readonly migrate: (value: Value) => Value;
};

/**
 * @description
 * Configures structured reporting for state persistence failures.
 * @docsPage core/state
 * @docsCategory Types
 */
export type StateServiceOptions = z.infer<typeof StateServiceOptionsSchema>;

/**
 * @description
 * Describes a failed operation against a named state collection.
 * @docsPage core/state
 * @docsCategory Types
 */
export type StatePersistenceFailure = z.infer<typeof StatePersistenceFailureSchema>;

/**
 * @description
 * Legacy application-state write options; use `StateWriteOptions` for generic collections.
 * @deprecated Use {@link StateWriteOptions}.
 */
export type ApplicationStateWriteOptions = StateWriteOptions;
