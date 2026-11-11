import { MarsaError } from '../common/errors/errors.js';
import { ConfigService } from '../config/config.service.js';
import type {
    ApplicationId,
    ApplicationInstanceId,
} from '../config/identifiers/identifier-generator.contract.js';
import { EventBus } from '../event-bus/event-bus.service.js';
import {
    ApplicationInstanceCreatedEvent,
    ApplicationInstanceDestroyedEvent,
    ApplicationInstanceFocusRequestedEvent,
    ApplicationInstanceStatusChangedEvent,
} from '../event-bus/events/application-instance.event.js';
import type { MarsaEvent } from '../event-bus/marsa-event.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import {
    ErrorReportingService,
    ReportServiceErrors,
    RuntimeErrorReporter,
} from '../runtime-error-manager/error-reporting.service.js';
import { SafeModeContext } from '../safe-mode/safe-mode-context.js';
import type {
    ApplicationInstance,
    ApplicationInstanceStatus,
    InstancePolicy,
} from '../schemas/applications.js';
import { LifecycleManager } from './helpers/lifecycle-manager.service.js';
import type { StateCollection } from './state.contract.js';
import { StateService } from './state.service.js';

const allowedTransitions: Readonly<Record<ApplicationInstanceStatus, readonly ApplicationInstanceStatus[]>> =
    {
        created: ['loading', 'closing'],
        loading: ['mounted', 'closing'],
        mounted: ['virtualized', 'closing'],
        virtualized: ['loading', 'closing'],
        closing: ['closed'],
        closed: [],
    };

@Injectable()
@ReportServiceErrors({ category: 'application' })
export class ApplicationInstanceManager extends ErrorReportingService {
    private readonly instances: StateCollection<ApplicationInstance>;
    private readonly pendingInstances = new Map<ApplicationInstanceId, ApplicationInstance>();
    private readonly reservedSingleInstances = new Map<ApplicationId, ApplicationInstanceId>();

    constructor(
        errorReporter: RuntimeErrorReporter,
        private readonly configService: ConfigService,
        private readonly eventBus: EventBus,
        private readonly lifecycleManager: LifecycleManager,
        private readonly stateService: StateService,
        private readonly safeModeContext: SafeModeContext,
    ) {
        super(errorReporter);
        this.instances = this.stateService.collection('application-instances', {
            persistenceEnabled: false,
        });
    }

    /**
     * @description
     * Creates an instance or returns the active single instance; safe mode prevents new instances.
     * @throws {MarsaError} If creation is blocked, the ID collides, or the single instance is closing.
     * @docsPage core/applications
     * @docsCategory Lifecycle
     */
    public async create(
        appId: ApplicationId,
        policy: InstancePolicy,
    ): Promise<{ readonly instance: ApplicationInstance; readonly created: boolean }> {
        const prepared = await this.prepareCreate(appId, policy);
        if (!prepared.created) {
            return prepared;
        }
        return { instance: await this.commitCreate(prepared.instance.id), created: true };
    }

    public async prepareCreate(
        appId: ApplicationId,
        policy: InstancePolicy,
    ): Promise<{ readonly instance: ApplicationInstance; readonly created: boolean }> {
        if (policy === 'single') {
            const existing = (await this.getAll(appId))[0];
            if (existing) {
                if (existing.status === 'closing') {
                    throw new MarsaError(
                        'INSTANCE_EXISTS',
                        `Application "${appId}" already has an instance that is closing.`,
                    );
                }
                return { instance: existing, created: false };
            }
            if (this.reservedSingleInstances.has(appId)) {
                throw new MarsaError(
                    'INSTANCE_EXISTS',
                    `Application "${appId}" already has a launch operation in progress.`,
                );
            }
        }

        this.safeModeContext.assertAllowed('Application instance creation');
        const id = this.configService.identifierOptions.generator.generate('application-instance');
        if ((await this.get(id)) || this.pendingInstances.has(id)) {
            throw new MarsaError(
                'IDENTIFIER_COLLISION',
                `Generated application instance ID "${id}" already exists.`,
            );
        }

        const timestamp = this.configService.timeOptions.provider.now();
        const instance: ApplicationInstance = Object.freeze({
            id,
            appId,
            status: 'created',
            createdAt: timestamp,
            lastActiveAt: timestamp,
        });

        this.pendingInstances.set(id, instance);
        if (policy === 'single') {
            this.reservedSingleInstances.set(appId, id);
        }
        return { instance, created: true };
    }

    /**
     * @description
     * Commits a prepared instance after lifecycle hooks succeed.
     * @throws {MarsaError} If safe mode is active or the prepared instance is missing.
     * @docsPage core/applications
     * @docsCategory Lifecycle
     */
    public async commitCreate(id: ApplicationInstanceId): Promise<ApplicationInstance> {
        this.safeModeContext.assertAllowed('Application instance creation');
        const instance = this.pendingInstances.get(id);
        if (!instance) {
            throw new MarsaError(
                'INSTANCE_NOT_FOUND',
                `Prepared application instance "${id}" does not exist.`,
            );
        }
        await this.instances.write(instance.id, instance, { immediate: true });
        this.pendingInstances.delete(id);
        this.reservedSingleInstances.delete(instance.appId);
        await this.eventBus.publish(new ApplicationInstanceCreatedEvent(instance));
        return instance;
    }

    /** Discards a prepared instance when its lifecycle operation is cancelled or fails. */
    public discardCreate(id: ApplicationInstanceId): void {
        const instance = this.pendingInstances.get(id);
        if (!instance) {
            return;
        }
        this.pendingInstances.delete(id);
        if (this.reservedSingleInstances.get(instance.appId) === id) {
            this.reservedSingleInstances.delete(instance.appId);
        }
    }

    /** Returns whether an application currently owns any active instances. */
    public async hasForApplication(appId: ApplicationId): Promise<boolean> {
        return (
            (await this.getAll(appId)).length > 0 ||
            [...this.pendingInstances.values()].some(instance => instance.appId === appId)
        );
    }

    /** Returns an instance by ID. */
    public async get(id: ApplicationInstanceId): Promise<ApplicationInstance | undefined> {
        return (await this.instances.read(id))?.value;
    }

    /** Returns active instances in creation order, optionally filtered by application. */
    public async getAll(appId?: ApplicationId): Promise<readonly ApplicationInstance[]> {
        const instances = (await this.instances.entries()).map(([, record]) => record.value);
        return appId ? instances.filter(instance => instance.appId === appId) : instances;
    }

    /**
     * @description
     * Transitions an instance only when the status change is valid; safe mode allows only recovery transitions.
     * @throws {MarsaError} If the transition is invalid or unavailable in safe mode.
     * @docsPage core/applications
     * @docsCategory Lifecycle
     */
    public async transition(
        id: ApplicationInstanceId,
        status: ApplicationInstanceStatus,
    ): Promise<{ readonly previous: ApplicationInstance; readonly current: ApplicationInstance }> {
        this.assertSafeModeTransition(status);
        const previous = await this.assertTransitionAllowed(id, status);
        let current: ApplicationInstance;
        if (status === 'virtualized') {
            const result = await this.lifecycleManager.perform(
                'onVirtualize',
                previous.appId,
                previous.id,
                async () => this.commitTransition(previous, status),
            );
            if (!result.completed) {
                throw new MarsaError(
                    'LIFECYCLE_CANCELLED',
                    'Application virtualization was cancelled by a before hook.',
                );
            }
            current = result.value;
        } else {
            current = await this.commitTransition(previous, status);
        }
        await this.eventBus.publish(new ApplicationInstanceStatusChangedEvent(previous, current));
        return { previous, current };
    }

    /** Validates a status transition without changing the authoritative instance record. */
    public async assertTransitionAllowed(
        id: ApplicationInstanceId,
        status: ApplicationInstanceStatus,
    ): Promise<ApplicationInstance> {
        this.assertSafeModeTransition(status);
        const previous = await this.get(id);
        if (!previous) {
            throw new MarsaError('INSTANCE_NOT_FOUND', `Application instance "${id}" does not exist.`);
        }

        if (!allowedTransitions[previous.status].includes(status)) {
            throw new MarsaError(
                'INVALID_INSTANCE_TRANSITION',
                `Cannot transition application instance "${id}" from "${previous.status}" to "${status}".`,
            );
        }
        return previous;
    }

    /** Transitions the instance to closed and removes its runtime record. */
    public async destroy(id: ApplicationInstanceId): Promise<ApplicationInstance> {
        const instance = await this.get(id);
        if (!instance) {
            throw new MarsaError('INSTANCE_NOT_FOUND', `Application instance "${id}" does not exist.`);
        }

        const result = await this.lifecycleManager.perform(
            'onClose',
            instance.appId,
            instance.id,
            async () => {
                const closedInstance = await this.transitionToClosed(instance);
                await this.instances.delete(id);
                return closedInstance;
            },
        );
        if (!result.completed) {
            throw new MarsaError('LIFECYCLE_CANCELLED', 'Application close was cancelled by a before hook.');
        }
        const { closed, transitions } = result.value;
        await this.publishEvents([
            ...transitions.map(
                transition =>
                    new ApplicationInstanceStatusChangedEvent(transition.previous, transition.current),
            ),
            new ApplicationInstanceDestroyedEvent(closed),
        ]);
        return closed;
    }

    /** Publishes a focus request for an existing instance. */
    public async requestFocus(id: ApplicationInstanceId): Promise<void> {
        const instance = await this.get(id);
        if (!instance) {
            throw new MarsaError('INSTANCE_NOT_FOUND', `Application instance "${id}" does not exist.`);
        }
        await this.eventBus.publish(new ApplicationInstanceFocusRequestedEvent(instance.appId, instance.id));
    }

    private async transitionToClosed(instance: ApplicationInstance): Promise<{
        readonly closed: ApplicationInstance;
        readonly transitions: readonly {
            readonly previous: ApplicationInstance;
            readonly current: ApplicationInstance;
        }[];
    }> {
        const transitions: Array<{
            readonly previous: ApplicationInstance;
            readonly current: ApplicationInstance;
        }> = [];
        let current = instance;

        if (current.status !== 'closed' && current.status !== 'closing') {
            const previous = current;
            current = await this.commitTransition(current, 'closing');
            transitions.push({ previous, current });
        }
        if (current.status !== 'closed') {
            const previous = current;
            current = await this.commitTransition(current, 'closed');
            transitions.push({ previous, current });
        }

        return { closed: current, transitions };
    }

    private async commitTransition(
        previous: ApplicationInstance,
        status: ApplicationInstanceStatus,
    ): Promise<ApplicationInstance> {
        const current: ApplicationInstance = Object.freeze({
            ...previous,
            status,
            lastActiveAt: this.configService.timeOptions.provider.now(),
        });
        await this.instances.write(current.id, current, { immediate: true });
        return current;
    }

    private assertSafeModeTransition(status: ApplicationInstanceStatus): void {
        if (this.safeModeContext.safeMode && !['virtualized', 'closing', 'closed'].includes(status)) {
            this.safeModeContext.assertAllowed(`Application instance transition to "${status}"`);
        }
    }

    private async publishEvents(events: readonly MarsaEvent[]): Promise<void> {
        const failures: unknown[] = [];
        for (const event of events) {
            try {
                await this.eventBus.publish(event);
            } catch (error) {
                failures.push(error);
            }
        }
        if (failures.length === 1) {
            throw failures[0];
        }
        if (failures.length > 1) {
            throw new AggregateError(
                failures,
                'One or more application instance events could not be published.',
            );
        }
    }
}
