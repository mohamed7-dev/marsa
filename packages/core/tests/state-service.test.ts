import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '../src/config/config.service.js';
import { MemoryPersistenceAdapterStrategy } from '../src/config/persistence/memory-persistence-adapter.strategy.js';
import type { PersistenceAdapterStrategy } from '../src/config/persistence/persistence-adapter.contract.js';
import { RuntimeErrorReporter } from '../src/runtime-error-manager/error-reporting.service.js';
import type { RuntimeErrorManager } from '../src/runtime-error-manager/runtime-error-manager.service.js';
import type { RuntimeErrorRecord } from '../src/runtime-error-manager/types.js';
import type { StatePersistenceFailure } from '../src/schemas/persistence.js';
import { StateService } from '../src/services/state.service.js';

function createReporter(): RuntimeErrorReporter {
    const errorManager = {
        capture: vi.fn(() => ({}) as RuntimeErrorRecord),
    } as unknown as RuntimeErrorManager;
    return new RuntimeErrorReporter(errorManager);
}

function createStateService(
    adapter: PersistenceAdapterStrategy,
    options: {
        readonly persistenceEnabled?: boolean;
        readonly schemaVersion?: number;
        readonly debounceMs?: number;
        readonly migrations?: readonly {
            readonly fromVersion: number;
            readonly toVersion: number;
            readonly migrate: (value: unknown) => unknown;
        }[];
        readonly onPersistenceError?: (failure: StatePersistenceFailure) => void;
    } = {},
): StateService {
    const configService = {
        persistenceOptions: { adapter },
        stateOptions: {
            persistenceEnabled: options.persistenceEnabled ?? true,
            schemaVersion: options.schemaVersion ?? 1,
            debounceMs: options.debounceMs ?? 300,
            migrations: options.migrations ?? [],
            ...(options.onPersistenceError ? { onPersistenceError: options.onPersistenceError } : {}),
        },
    } as unknown as ConfigService;
    return new StateService(createReporter(), configService);
}

describe('StateService generic collections', () => {
    it('isolates CRUD operations by caller-defined collection and key', async () => {
        const state = createStateService(new MemoryPersistenceAdapterStrategy());
        const profiles = state.collection<{ name: string }>('plugin-profiles');
        const settings = state.collection<{ name: string }>('plugin-settings');

        await profiles.write('user-1', { name: 'Ada' }, { immediate: true });
        await settings.write('user-1', { name: 'dark-mode' }, { immediate: true });

        await expect(profiles.read('user-1')).resolves.toMatchObject({
            value: { name: 'Ada' },
        });
        await expect(settings.read('user-1')).resolves.toMatchObject({
            value: { name: 'dark-mode' },
        });
        await profiles.delete('user-1');
        await expect(profiles.read('user-1')).resolves.toBeUndefined();
        await expect(settings.read('user-1')).resolves.toMatchObject({
            value: { name: 'dark-mode' },
        });
    });

    it('coalesces debounced writes and flushes the latest value', async () => {
        const state = createStateService(new MemoryPersistenceAdapterStrategy(), { debounceMs: 60_000 });
        const records = state.collection<{ count: number }>('records');
        const firstWrite = records.write('entry', { count: 1 });
        const secondWrite = records.write('entry', { count: 2 });

        await records.flush();
        await Promise.all([firstWrite, secondWrite]);

        await expect(records.read('entry')).resolves.toMatchObject({ value: { count: 2 } });
    });

    it('keeps durable values on release and removes temporary values', async () => {
        const adapter = new MemoryPersistenceAdapterStrategy();
        const state = createStateService(adapter);
        const records = state.collection('records');
        await records.write('durable', { saved: true }, { durable: true, immediate: true });
        await records.write('temporary', { transient: true }, { immediate: true });

        await records.release('durable');
        await records.release('temporary');
        await records.write('durable', { saved: 'again' }, { immediate: true });

        await expect(records.read('durable')).resolves.toMatchObject({
            value: { saved: 'again' },
        });
        await expect(records.read('temporary')).resolves.toBeUndefined();
        const reopened = createStateService(adapter).collection('records');
        await expect(reopened.read('durable')).resolves.toMatchObject({
            value: { saved: 'again' },
        });
    });

    it('applies migrations to opaque values and persists the current version', async () => {
        const adapter = new MemoryPersistenceAdapterStrategy();
        const store = adapter.store('records');
        await store.write('entry', { schemaVersion: 1, value: { count: 1 } });
        const state = createStateService(adapter, {
            schemaVersion: 2,
            migrations: [
                {
                    fromVersion: 1,
                    toVersion: 2,
                    migrate: value => ({ ...(value as { count: number }), migrated: true }),
                },
            ],
        });

        await expect(state.collection('records').read('entry')).resolves.toMatchObject({
            schemaVersion: 2,
            value: { count: 1, migrated: true },
        });
        await expect(store.read('entry')).resolves.toMatchObject({ schemaVersion: 2 });
    });

    it('does not change stored data when a migration fails', async () => {
        const adapter = new MemoryPersistenceAdapterStrategy();
        const store = adapter.store('records');
        const original = { schemaVersion: 1, value: { count: 1 } };
        await store.write('entry', original);
        const state = createStateService(adapter, {
            schemaVersion: 2,
            migrations: [
                {
                    fromVersion: 1,
                    toVersion: 2,
                    migrate: () => {
                        throw new Error('unsupported value');
                    },
                },
            ],
        });

        await expect(state.collection('records').read('entry')).rejects.toMatchObject({
            code: 'PERSISTENCE_MIGRATION_FAILED',
        });
        await expect(store.read('entry')).resolves.toEqual(original);
    });

    it('uses memory-only collections when persistence is disabled globally or locally', async () => {
        const adapter = new MemoryPersistenceAdapterStrategy();
        const disabled = createStateService(adapter, { persistenceEnabled: false });
        await disabled.collection('global-disabled').write('entry', { value: 1 }, { immediate: true });
        await disabled
            .collection('global-disabled-override', { persistenceEnabled: true })
            .write('entry', { value: 3 }, { immediate: true });
        await disabled
            .collection('local-disabled', { persistenceEnabled: false })
            .write('entry', { value: 2 }, { immediate: true });

        await expect(adapter.store('global-disabled').read('entry')).resolves.toBeUndefined();
        await expect(adapter.store('global-disabled-override').read('entry')).resolves.toBeUndefined();
        await expect(adapter.store('local-disabled').read('entry')).resolves.toBeUndefined();
    });

    it('rejects failed writes while retaining the latest in-memory value and reporting collection context', async () => {
        const adapter = new MemoryPersistenceAdapterStrategy();
        const writeError = new Error('storage unavailable');
        vi.spyOn(adapter.store('plugin-state'), 'write').mockRejectedValue(writeError);
        const onPersistenceError = vi.fn();
        const state = createStateService(adapter, { onPersistenceError });
        const records = state.collection<{ latest: boolean }>('plugin-state');

        await expect(records.write('entry', { latest: true }, { immediate: true })).rejects.toMatchObject({
            code: 'PERSISTENCE_WRITE_FAILED',
        });
        await expect(records.read('entry')).resolves.toMatchObject({ value: { latest: true } });
        expect(onPersistenceError).toHaveBeenCalledWith(
            expect.objectContaining({ operation: 'write', collection: 'plugin-state', key: 'entry' }),
        );
    });
});
