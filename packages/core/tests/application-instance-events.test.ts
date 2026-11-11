import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '../src/config/config.service.js';
import type { ApplicationId } from '../src/config/identifiers/identifier-generator.contract.js';
import { MemoryPersistenceAdapterStrategy } from '../src/config/persistence/memory-persistence-adapter.strategy.js';
import type { EventBus } from '../src/event-bus/event-bus.service.js';
import {
    ApplicationInstanceCreatedEvent,
    ApplicationInstanceDestroyedEvent,
    ApplicationInstanceFocusRequestedEvent,
    ApplicationInstanceStatusChangedEvent,
} from '../src/event-bus/events/application-instance.event.js';
import {
    ApplicationInstalledEvent,
    ApplicationLaunchedEvent,
    ApplicationUninstalledEvent,
} from '../src/event-bus/events/application.event.js';
import { RuntimeErrorReporter } from '../src/runtime-error-manager/error-reporting.service.js';
import type { RuntimeErrorManager } from '../src/runtime-error-manager/runtime-error-manager.service.js';
import type { RuntimeErrorRecord } from '../src/runtime-error-manager/types.js';
import { SafeModeContext } from '../src/safe-mode/safe-mode-context.js';
import { ApplicationInstanceManager } from '../src/services/application-instance-manager.service.js';
import { ApplicationManager } from '../src/services/application.service.js';
import { Validator } from '../src/services/helpers/validator.service.js';
import { StateService } from '../src/services/state.service.js';

function createReporter(): RuntimeErrorReporter {
    const errorManager = {
        capture: vi.fn(() => ({}) as RuntimeErrorRecord),
    } as unknown as RuntimeErrorManager;
    return new RuntimeErrorReporter(errorManager);
}

function createConfigService(): ConfigService {
    let identifier = 0;
    return {
        persistenceOptions: {
            adapter: new MemoryPersistenceAdapterStrategy(),
        },
        stateOptions: {
            persistenceEnabled: true,
            schemaVersion: 1,
            debounceMs: 0,
            migrations: [],
        },
        identifierOptions: {
            generator: {
                generate: () => `generated-${++identifier}`,
            },
        },
        timeOptions: {
            provider: {
                now: () => identifier,
            },
        },
    } as unknown as ConfigService;
}

function createStateService(configService: ConfigService): StateService {
    return new StateService(createReporter(), configService);
}

describe('application instance events', () => {
    it('publishes typed events after instance creation, status changes, and destruction', async () => {
        const events: unknown[] = [];
        const eventBus = {
            publish: vi.fn(async (event: unknown) => {
                events.push(event);
            }),
        } as unknown as EventBus;
        const configService = createConfigService();
        const lifecycleManager = {
            register: () => () => undefined,
            perform: async (
                _event: string,
                _appId: string,
                _instanceId: string,
                operation: () => unknown,
            ) => ({
                completed: true,
                value: await operation(),
            }),
        };
        const stateService = createStateService(configService);
        const manager = new ApplicationInstanceManager(
            createReporter(),
            configService,
            eventBus,
            lifecycleManager as never,
            stateService,
            new SafeModeContext(),
        );

        const { instance } = await manager.create('app-id' as ApplicationId, 'multiple');
        const instances = stateService.collection('application-instances', { persistenceEnabled: false });
        await expect(instances.read(instance.id)).resolves.toMatchObject({ value: instance });
        expect(events[0]).toBeInstanceOf(ApplicationInstanceCreatedEvent);
        expect((events[0] as ApplicationInstanceCreatedEvent).instance).toBe(instance);

        await manager.requestFocus(instance.id);
        expect(events[1]).toBeInstanceOf(ApplicationInstanceFocusRequestedEvent);
        expect(events[1]).toMatchObject({ appId: instance.appId, instanceId: instance.id });

        const transition = await manager.transition(instance.id, 'loading');
        await expect(instances.read(instance.id)).resolves.toMatchObject({
            value: { status: 'loading' },
        });
        expect(events[2]).toBeInstanceOf(ApplicationInstanceStatusChangedEvent);
        expect(events[2]).toMatchObject({
            previous: transition.previous,
            current: transition.current,
            status: 'loading',
        });

        const destroyed = await manager.destroy(instance.id);
        await expect(instances.read(instance.id)).resolves.toBeUndefined();
        expect(events.slice(3, 5)).toMatchObject([{ status: 'closing' }, { status: 'closed' }]);
        expect(events[5]).toBeInstanceOf(ApplicationInstanceDestroyedEvent);
        expect((events[5] as ApplicationInstanceDestroyedEvent).instance).toBe(destroyed);
        expect(eventBus.publish).toHaveBeenCalledTimes(6);
    });
});

describe('application events', () => {
    it('publishes install, launch, and uninstall events with typed payloads', async () => {
        const events: unknown[] = [];
        const eventBus = {
            publish: vi.fn(async (event: unknown) => {
                events.push(event);
            }),
        } as unknown as EventBus;
        const instance = {
            id: 'instance-id',
            appId: 'generated-1',
            status: 'created',
            createdAt: 1,
            lastActiveAt: 1,
        };
        let isFirstLaunch = true;
        const instanceManager = {
            prepareCreate: () => {
                if (isFirstLaunch) {
                    isFirstLaunch = false;
                    return { instance, created: true };
                }
                return { instance, created: false };
            },
            commitCreate: vi.fn(async () => instance),
            discardCreate: vi.fn(),
            get: async () => instance,
            hasForApplication: () => false,
            requestFocus: vi.fn(async () => undefined),
        };
        const lifecycleManager = {
            perform: async (
                _event: string,
                _appId: string,
                _instanceId: string,
                operation: () => unknown,
            ) => ({
                completed: true,
                value: await operation(),
            }),
        };
        const configService = createConfigService();
        const stateService = createStateService(configService);
        const manager = new ApplicationManager(
            createReporter(),
            new Validator(),
            stateService,
            eventBus,
            configService,
            lifecycleManager as never,
            instanceManager as never,
            new SafeModeContext(),
        );

        const installedRecord = await manager.install({
            bin: 'users',
            title: 'Users',
            policies: { instances: 'multiple' },
        });
        if (!installedRecord) {
            throw new Error('Expected application installation to return its persisted record.');
        }
        const appId = installedRecord.value.id;
        const applications = stateService.collection('applications');
        const storedApplication = await applications.read(appId);
        if (!storedApplication) {
            throw new Error('Expected installed application to be persisted.');
        }
        const application = storedApplication.value;
        expect(events[0]).toBeInstanceOf(ApplicationInstalledEvent);
        expect((events[0] as ApplicationInstalledEvent).application).toEqual(application);

        await manager.launchApp(appId);
        expect(events[1]).toBeInstanceOf(ApplicationLaunchedEvent);
        expect(events[1]).toMatchObject({
            application,
            instance,
            created: true,
        });

        await manager.launchApp(appId);
        expect(instanceManager.requestFocus).toHaveBeenCalledOnce();
        expect(instanceManager.requestFocus).toHaveBeenCalledWith(instance.id);
        expect(events[2]).toBeInstanceOf(ApplicationLaunchedEvent);
        expect(events[2]).toMatchObject({ created: false });

        await manager.uninstall(appId);
        await expect(
            configService.persistenceOptions.adapter.store('applications').read(appId),
        ).resolves.toBeUndefined();
        expect(events[3]).toBeInstanceOf(ApplicationUninstalledEvent);
        expect((events[3] as ApplicationUninstalledEvent).application).toEqual(application);
        expect(eventBus.publish).toHaveBeenCalledTimes(4);
    });
});
