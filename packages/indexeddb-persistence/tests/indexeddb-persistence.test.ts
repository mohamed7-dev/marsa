import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDBPersistenceAdapter } from '../src/index.js';

let databaseNumber = 0;
const adapters: IndexedDBPersistenceAdapter[] = [];

function createAdapter(databaseName = `marsa-test-${++databaseNumber}`): IndexedDBPersistenceAdapter {
    const adapter = new IndexedDBPersistenceAdapter({
        databaseName,
        indexedDB,
    });
    adapters.push(adapter);
    return adapter;
}

afterEach(async () => {
    await Promise.all(adapters.splice(0).map(adapter => adapter.close()));
});

describe('IndexedDBPersistenceAdapter', () => {
    it('reads, writes, deletes, and flushes versioned records', async () => {
        const adapter = createAdapter();
        const store = adapter.store('settings');

        await expect(store.read('appearance')).resolves.toBeUndefined();
        await store.write('appearance', { schemaVersion: 2, value: { theme: 'dark' } });
        await adapter.flush();
        await expect(store.read('appearance')).resolves.toEqual({
            schemaVersion: 2,
            value: { theme: 'dark' },
        });

        await store.delete('appearance');

        await expect(store.read('appearance')).resolves.toBeUndefined();
    });

    it('isolates same-key records between purpose-specific stores and lists store content', async () => {
        const adapter = createAdapter();
        const state = adapter.store('application-state');
        const auditLogs = adapter.store('audit-logs');

        await state.write('shared-key', { schemaVersion: 1, value: { value: 'state' } });
        await auditLogs.write('shared-key', { schemaVersion: 1, value: { value: 'audit' } });

        await expect(state.read('shared-key')).resolves.toEqual({
            schemaVersion: 1,
            value: { value: 'state' },
        });
        await expect(auditLogs.read('shared-key')).resolves.toEqual({
            schemaVersion: 1,
            value: { value: 'audit' },
        });
        await expect(state.entries()).resolves.toEqual([
            ['shared-key', { schemaVersion: 1, value: { value: 'state' } }],
        ]);
        await expect(auditLogs.entries()).resolves.toEqual([
            ['shared-key', { schemaVersion: 1, value: { value: 'audit' } }],
        ]);
    });

    it('retains records across connection close and reopen', async () => {
        const adapter = createAdapter();
        const store = adapter.store('application-state');

        await store.write('instance:one', { schemaVersion: 1, value: { draft: 'saved' } });
        await adapter.close();

        await expect(store.read('instance:one')).resolves.toEqual({
            schemaVersion: 1,
            value: { draft: 'saved' },
        });
    });

    it('continues reading application-state records from the previous default object store', async () => {
        const databaseName = `marsa-legacy-${++databaseNumber}`;
        await new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(databaseName, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore('records', { keyPath: 'key' });
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction('records', 'readwrite');
                transaction.objectStore('records').put({
                    key: 'legacy-state',
                    schemaVersion: 1,
                    value: { draft: 'kept' },
                });
                transaction.oncomplete = () => {
                    database.close();
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            };
        });

        const adapter = createAdapter(databaseName);
        await expect(adapter.store('application-state').read('legacy-state')).resolves.toEqual({
            schemaVersion: 1,
            value: { draft: 'kept' },
        });
    });

    it('retains versioned records through a new adapter instance', async () => {
        const databaseName = `marsa-durable-${++databaseNumber}`;
        const firstAdapter = createAdapter(databaseName);
        const key = JSON.stringify(['durable-app', 'durable-instance']);
        const stateRecords = firstAdapter.store('application-state');
        await stateRecords.write(key, {
            schemaVersion: 1,
            value: { draft: 'survives reload' },
        });
        await firstAdapter.flush();
        await firstAdapter.close();

        const secondAdapter = createAdapter(databaseName);
        const secondStateRecords = secondAdapter.store('application-state');
        await expect(secondStateRecords.read(key)).resolves.toEqual({
            schemaVersion: 1,
            value: { draft: 'survives reload' },
        });
    });

    it('rejects invalid keys and schema versions without reporting a successful write', async () => {
        const adapter = createAdapter();
        const store = adapter.store('settings');

        await expect(store.read(' ')).rejects.toThrow('Persistence key must not be empty.');
        await expect(store.write('settings', { schemaVersion: 0, value: null })).rejects.toThrow(
            'Persisted schemaVersion must be a positive safe integer.',
        );
        await expect(adapter.flush()).rejects.toMatchObject({
            name: 'AggregateError',
            errors: [
                expect.objectContaining({ message: 'Persistence key must not be empty.' }),
                expect.objectContaining({
                    message: 'Persisted schemaVersion must be a positive safe integer.',
                }),
            ],
        });
    });

    it('surfaces IndexedDB write failures', async () => {
        const adapter = createAdapter();
        const store = adapter.store('stable-values');

        await store.write('stable', { schemaVersion: 1, value: { count: 1 } });
        await expect(
            store.write('stable', { schemaVersion: 2, value: () => undefined }),
        ).rejects.toBeDefined();
        await expect(adapter.close()).rejects.toBeDefined();
        await expect(store.read('stable')).resolves.toEqual({
            schemaVersion: 1,
            value: { count: 1 },
        });
    });
});
