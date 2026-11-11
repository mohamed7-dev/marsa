import type { PersistedRecord, StateWriteOptions } from '../schemas/persistence.js';

/**
 * @description
 * Provides generic versioned state operations within one named collection.
 * @docsPage core/state
 * @docsCategory Contracts
 */
export interface StateCollection<Value = unknown> {
    /**
     * @description
     * Reads a value by key, applying configured migrations when necessary.
     * @param key Non-empty collection key.
     * @returns The stored versioned value, or `undefined` when absent.
     * @throws Rejects when storage or migration fails.
     */
    read(key: string): Promise<PersistedRecord<Value> | undefined>;
    /**
     * @description
     * Updates the in-memory value and schedules its persistence.
     * @param key Non-empty collection key.
     * @param value Opaque value to store.
     * @param options Version, durability, and scheduling overrides.
     * @returns Resolves after the pending write commits.
     * @throws Rejects on persistence failure while retaining the in-memory value.
     */
    write(key: string, value: Value, options?: StateWriteOptions): Promise<void>;
    /**
     * @description
     * Deletes a value from both memory and the backing store.
     * @param key Non-empty collection key.
     * @throws Rejects when pending writes or deletion fail.
     */
    delete(key: string): Promise<void>;
    /**
     * @description
     * Lists the collection's stored keys and versioned values.
     * @returns Key-record pairs from this collection.
     * @throws Rejects when storage or migration fails.
     */
    entries(): Promise<readonly (readonly [string, PersistedRecord<Value>])[]>;
    /**
     * @description
     * Releases a key from memory, deleting it unless its last write was marked durable.
     * @param key Non-empty collection key.
     * @throws Rejects when pending writes or deletion fail.
     */
    release(key: string): Promise<void>;
    /**
     * @description
     * Flushes pending writes for this collection.
     * @throws Rejects when one or more writes fail.
     */
    flush(): Promise<void>;
}

/**
 * @description
 * Opts a named collection out of persistence while global persistence is enabled.
 * Global `stateOptions.persistenceEnabled: false` always selects in-memory storage.
 * @docsPage core/state
 * @docsCategory Types
 */
export interface StateCollectionOptions {
    /**
     * @description
     * Disables persistence for this collection; it cannot re-enable globally disabled persistence.
     */
    readonly persistenceEnabled?: boolean;
}
