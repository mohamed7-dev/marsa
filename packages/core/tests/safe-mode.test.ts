import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { getConfig, resetConfig } from '../src/config/config-utils.js';
import type { ConfigService } from '../src/config/config.service.js';
import type {
    ApplicationId,
    ApplicationInstanceId,
} from '../src/config/identifiers/identifier-generator.contract.js';
import type { LoggerStrategy } from '../src/config/logger/logger-strategy.contract.js';
import { MemoryPersistenceAdapterStrategy } from '../src/config/persistence/memory-persistence-adapter.strategy.js';
import { EntryModule } from '../src/entry.module.js';
import type { EventBus } from '../src/event-bus/event-bus.service.js';
import { IocContainer } from '../src/infra/ioc-container/ioc-container.js';
import { Logger } from '../src/logger/logger.js';
import { RuntimeErrorReporter } from '../src/runtime-error-manager/error-reporting.service.js';
import type { RuntimeErrorManager as RuntimeErrorManagerContract } from '../src/runtime-error-manager/runtime-error-manager.service.js';
import { RuntimeErrorManager } from '../src/runtime-error-manager/runtime-error-manager.service.js';
import type { RuntimeErrorRecord } from '../src/runtime-error-manager/types.js';
import { SafeModeContext } from '../src/safe-mode/safe-mode-context.js';
import { ApplicationInstanceManager } from '../src/services/application-instance-manager.service.js';
import { ApplicationManager } from '../src/services/application.service.js';
import { LifecycleManager } from '../src/services/helpers/lifecycle-manager.service.js';
import { PermissionManager } from '../src/services/helpers/permission-manager.service.js';
import { Validator } from '../src/services/helpers/validator.service.js';
import { StateService } from '../src/services/state.service.js';

function createConfigService(): ConfigService {
    let identifier = 0;
    return {
        persistenceOptions: { adapter: new MemoryPersistenceAdapterStrategy() },
        stateOptions: {
            persistenceEnabled: true,
            schemaVersion: 1,
            debounceMs: 0,
            migrations: [],
        },
        identifierOptions: {
            generator: { generate: () => `generated-${++identifier}` },
        },
        timeOptions: { provider: { now: () => identifier } },
        lifecycleOptions: {},
    } as unknown as ConfigService;
}

function createReporter(): RuntimeErrorReporter {
    const errorManager = {
        capture: vi.fn(() => ({}) as RuntimeErrorRecord),
    } as unknown as RuntimeErrorManagerContract;
    return new RuntimeErrorReporter(errorManager);
}

function expectSafeModeFailure(operation: Promise<unknown>): Promise<void> {
    return expect(operation).rejects.toMatchObject({ code: 'SAFE_MODE' });
}

describe('safe mode', () => {
    it('shares fatal activation across services through the runtime modules', async () => {
        await resetConfig();
        const config = await getConfig();
        Logger.useLogger(config.loggerOptions.strategy);
        const container = new IocContainer();
        container.loadModule(EntryModule);
        const runtimeErrors = container.resolve<RuntimeErrorManager>(RuntimeErrorManager);
        const applications = container.resolve<ApplicationManager>(ApplicationManager);
        const instances = container.resolve<ApplicationInstanceManager>(ApplicationInstanceManager);

        runtimeErrors.capture(new Error('fatal'), {
            category: 'fatal',
            code: 'FATAL_RUNTIME_ERROR',
            source: 'test',
        });

        await expectSafeModeFailure(
            applications.install({
                bin: 'users',
                title: 'Users',
                policies: { instances: 'multiple' },
            }),
        );
        await expectSafeModeFailure(instances.create('application-a' as ApplicationId, 'multiple'));
    });

    it('enters after a fatal runtime error and remains active', () => {
        const logger: LoggerStrategy = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            verbose: vi.fn(),
            warn: vi.fn(),
        };
        Logger.useLogger(logger);
        const safeMode = new SafeModeContext();
        const config = createConfigService();
        const manager = new RuntimeErrorManager(config, safeMode);

        manager.capture(new Error('fatal'), {
            category: 'fatal',
            code: 'FATAL_RUNTIME_ERROR',
            source: 'test',
        });

        expect(safeMode.safeMode).toBe(true);
        expect(() => safeMode.assertAllowed('A nonessential operation')).toThrowError(
            expect.objectContaining({ code: 'SAFE_MODE' }),
        );
    });

    it('enters safe mode when a previously reported error is escalated to fatal', () => {
        const logger: LoggerStrategy = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            verbose: vi.fn(),
            warn: vi.fn(),
        };
        Logger.useLogger(logger);
        const safeMode = new SafeModeContext();
        const manager = new RuntimeErrorManager(createConfigService(), safeMode);
        const error = new Error('escalated');

        manager.capture(error, {
            category: 'application',
            code: 'APP_ERROR',
            source: 'test',
        });
        manager.capture(error, {
            category: 'fatal',
            code: 'FATAL_RUNTIME_ERROR',
            source: 'test',
        });

        expect(safeMode.safeMode).toBe(true);
    });

    it('keeps generic state persistence available for recovery', async () => {
        const config = createConfigService();
        const safeMode = new SafeModeContext();
        const records = new StateService(createReporter(), config).collection<{ recovered: boolean }>(
            'recovery-state',
        );
        safeMode.enter();

        await records.write('checkpoint', { recovered: true }, { durable: true, immediate: true });
        await expect(records.read('checkpoint')).resolves.toMatchObject({
            value: { recovered: true },
        });
        await records.flush();
    });

    it('blocks application registry changes and new launches while allowing focus of an existing instance', async () => {
        const config = createConfigService();
        const state = new StateService(createReporter(), config);
        const events: unknown[] = [];
        const eventBus = {
            publish: vi.fn(async (event: unknown) => {
                events.push(event);
            }),
        } as unknown as EventBus;
        const instance = {
            id: 'existing-instance',
            appId: 'generated-1',
            status: 'created',
            createdAt: 1,
            lastActiveAt: 1,
        };
        const instanceManager = {
            prepareCreate: vi.fn(async (): Promise<{ instance: typeof instance; created: boolean }> => ({
                instance,
                created: true,
            })),
            commitCreate: vi.fn(async () => instance),
            discardCreate: vi.fn(),
            get: vi.fn(async () => instance),
            hasForApplication: vi.fn(async () => false),
            requestFocus: vi.fn(async () => undefined),
        };
        const lifecycleManager = {
            perform: async (
                _event: string,
                _appId: string,
                _instanceId: string,
                operation: () => unknown | Promise<unknown>,
            ) => ({ completed: true as const, value: await operation() }),
        };
        const safeMode = new SafeModeContext();
        const applications = new ApplicationManager(
            createReporter(),
            new Validator(),
            state,
            eventBus,
            config,
            lifecycleManager as never,
            instanceManager as never,
            safeMode,
        );
        const installed = await applications.install({
            bin: 'users',
            title: 'Users',
            policies: { instances: 'single' },
        });
        if (!installed) {
            throw new Error('Expected the application to be installed before entering safe mode.');
        }
        safeMode.enter();

        await expectSafeModeFailure(
            applications.install({
                bin: 'reports',
                title: 'Reports',
                policies: { instances: 'multiple' },
            }),
        );
        await expectSafeModeFailure(applications.uninstall(installed.value.id));
        await expectSafeModeFailure(applications.launchApp(installed.value.id));
        expect(instanceManager.discardCreate).toHaveBeenCalledOnce();

        instanceManager.prepareCreate.mockResolvedValue({ instance, created: false });
        await expect(applications.launchApp(installed.value.id)).resolves.toBe(instance.id);
        expect(instanceManager.requestFocus).toHaveBeenCalledOnce();
    });

    it('blocks instance creation and progression while preserving focus', async () => {
        const config = createConfigService();
        const safeMode = new SafeModeContext();
        const events: unknown[] = [];
        const eventBus = {
            publish: vi.fn(async (event: unknown) => {
                events.push(event);
            }),
        } as unknown as EventBus;
        const lifecycleManager = {
            perform: async (
                _event: string,
                _appId: string,
                _instanceId: string,
                operation: () => unknown | Promise<unknown>,
            ) => ({ completed: true as const, value: await operation() }),
        };
        const instances = new ApplicationInstanceManager(
            createReporter(),
            config,
            eventBus,
            lifecycleManager as never,
            new StateService(createReporter(), config),
            safeMode,
        );
        const { instance } = await instances.create('application-a' as ApplicationId, 'multiple');
        await instances.transition(instance.id, 'loading');
        await instances.transition(instance.id, 'mounted');
        const pending = await instances.prepareCreate('application-b' as ApplicationId, 'multiple');
        safeMode.enter();

        await expectSafeModeFailure(instances.create('application-a' as ApplicationId, 'multiple'));
        await expectSafeModeFailure(instances.commitCreate(pending.instance.id));
        await expectSafeModeFailure(instances.transition(instance.id, 'loading'));
        await expect(instances.requestFocus(instance.id)).resolves.toBeUndefined();
        instances.discardCreate(pending.instance.id);
    });

    it('allows virtualization and closing transitions during safe mode', async () => {
        const config = createConfigService();
        const safeMode = new SafeModeContext();
        const eventBus = { publish: vi.fn(async () => undefined) } as unknown as EventBus;
        const lifecycleManager = {
            perform: async (
                _event: string,
                _appId: string,
                _instanceId: string,
                operation: () => unknown | Promise<unknown>,
            ) => ({ completed: true as const, value: await operation() }),
        };
        const instances = new ApplicationInstanceManager(
            createReporter(),
            config,
            eventBus,
            lifecycleManager as never,
            new StateService(createReporter(), config),
            safeMode,
        );
        const { instance } = await instances.create('application-b' as ApplicationId, 'multiple');
        await instances.transition(instance.id, 'loading');
        await instances.transition(instance.id, 'mounted');
        safeMode.enter();

        await expect(instances.transition(instance.id, 'virtualized')).resolves.toMatchObject({
            current: { status: 'virtualized' },
        });
        await expect(instances.requestFocus(instance.id)).resolves.toBeUndefined();
        await expect(instances.destroy(instance.id)).resolves.toMatchObject({ status: 'closed' });
    });

    it('blocks direct nonessential lifecycle operations while permitting close and state-preserving virtualization', async () => {
        const config = createConfigService();
        const safeMode = new SafeModeContext();
        const errorManager = {
            capture: vi.fn(() => ({}) as RuntimeErrorRecord),
        } as unknown as RuntimeErrorManagerContract;
        const lifecycle = new LifecycleManager(
            createReporter(),
            new Validator(),
            errorManager as never,
            config,
            safeMode,
        );
        const operation = vi.fn(async () => 'completed');
        const appId = 'application-a' as ApplicationId;
        const instanceId = 'instance-a' as ApplicationInstanceId;
        safeMode.enter();

        await expectSafeModeFailure(lifecycle.perform('onMount', appId, instanceId, operation));
        expect(operation).not.toHaveBeenCalled();
        await expect(lifecycle.perform('onVirtualize', appId, instanceId, operation)).resolves.toMatchObject({
            completed: true,
            value: 'completed',
        });
        await expect(lifecycle.perform('onClose', appId, instanceId, operation)).resolves.toMatchObject({
            completed: true,
        });
    });

    it('denies capability authorization in safe mode and keeps revocation available', () => {
        const config = createConfigService();
        const safeMode = new SafeModeContext();
        const store = { write: vi.fn(async () => undefined) };
        const persistence = {
            persistenceAdapter: {
                store: vi.fn(() => store),
                flush: vi.fn(async () => undefined),
            },
        };
        const permissions = new PermissionManager(createReporter(), persistence as never, config, safeMode);
        safeMode.enter();

        expect(
            permissions.authorize('application-a' as ApplicationId, 'events.publish', ['events.publish']),
        ).toBe(false);
        expect(permissions.getAuditLog().map(record => record.action)).toEqual(['requested', 'denied']);
        expect(permissions.revokeCapability('application-a' as ApplicationId, 'events.publish')).toBe(false);
    });
});
