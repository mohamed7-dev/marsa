import type { PersistedRecord, PersistedRecordEntry } from '../../schemas/persistence.js';

/**
 * @description
 * Exposes keyed operations scoped to exactly one purpose-specific persistence store.
 * @docsPage core/persistence
 * @docsCategory Contracts
 */
export interface PersistenceStore {
    /**
     * @description
     * Reads a record by key from this store only.
     * @param key Non-empty record key.
     * @returns The stored record, or `undefined` when absent.
     * @throws Rejects when the storage operation fails.
     */
    read(key: string): Promise<PersistedRecord | undefined>;
    /**
     * @description
     * Writes a versioned record under a key in this store only.
     * @param key Non-empty record key.
     * @param record Versioned record to persist.
     * @returns Resolves after the record is committed.
     * @throws Rejects when validation or storage fails.
     */
    write(key: string, record: PersistedRecord): Promise<void>;
    /**
     * @description
     * Deletes a key from this store only.
     * @param key Non-empty record key.
     * @returns Resolves after deletion is committed.
     * @throws Rejects when the storage operation fails.
     */
    delete(key: string): Promise<void>;
    /**
     * @description
     * Lists this store's key-record pairs.
     * @returns Key-record pairs from this store.
     * @throws Rejects when the storage operation or record validation fails.
     */
    entries(): Promise<readonly PersistedRecordEntry[]>;
}

/**
 * @description
 * This interface defines the contract of a persistence adapter.
 * It opens named purpose-specific stores while keeping storage-engine details behind an adapter.
 * @docsPage core/persistence
 * @docsCategory Contracts
 */
export interface PersistenceAdapterStrategy {
    /**
     * @description
     * Returns a handle scoped to a named store, creating that store on first operation.
     * @param name Non-empty purpose-specific store name.
     * @returns A handle whose data operations cannot access another named store.
     * @throws {Error} If the store name is empty or invalid.
     */
    store(name: string): PersistenceStore;
    /**
     * @description
     * Waits for queued persistence operations to complete.
     * @returns Resolves after queued operations settle.
     * @throws Rejects when one or more queued operations fail.
     */
    flush(): Promise<void>;
}
