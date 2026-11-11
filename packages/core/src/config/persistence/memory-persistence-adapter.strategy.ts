import { PersistenceStoreNameSchema, type PersistedRecord } from '../../schemas/persistence.js';
import { type PersistenceAdapterStrategy, type PersistenceStore } from './persistence-adapter.contract.js';

/**
 * @description
 * In-memory implementation of the {@link PersistenceAdapterStrategy} interface.
 * It keeps purpose-specific stores in memory for tests and lightweight host runtimes.
 * @docsPage core/persistence
 * @docsCategory Adapters
 */
export class MemoryPersistenceAdapterStrategy implements PersistenceAdapterStrategy {
    private readonly values = new Map<string, Map<string, PersistedRecord>>();
    private readonly stores = new Map<string, PersistenceStore>();

    /**
     * @description
     * Returns a handle scoped to one named store, creating it on first access.
     * @param name Non-empty purpose-specific store name.
     * @returns A store handle whose operations cannot access another store.
     */
    public store(name: string): PersistenceStore {
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

        const records = this.values.get(name) ?? new Map<string, PersistedRecord>();
        this.values.set(name, records);
        const scopedStore: PersistenceStore = {
            read: async key => {
                const record = records.get(key);
                if (!record) {
                    return undefined;
                }

                return cloneRecord(record);
            },
            write: async (key, record) => {
                records.set(key, cloneRecord(record));
            },
            delete: async key => {
                records.delete(key);
            },
            entries: async () =>
                [...records.entries()].map(([key, record]) => [key, cloneRecord(record)] as const),
        };
        this.stores.set(name, scopedStore);
        return scopedStore;
    }

    /**
     * @description
     * Completes all writes; the in-memory adapter has no deferred work.
     */
    async flush(): Promise<void> {
        // Nothing to flush for an in-memory adapter.
    }
}

function cloneRecord(record: PersistedRecord): PersistedRecord {
    return {
        ...record,
        value: structuredClone(record.value),
    };
}
