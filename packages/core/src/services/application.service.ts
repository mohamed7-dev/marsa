import { MarsaError } from '../common/errors/errors.js';
import { ConfigService } from '../config/config.service.js';
import type {
    ApplicationId,
    ApplicationInstanceId,
} from '../config/identifiers/identifier-generator.contract.js';
import { EventBus } from '../event-bus/event-bus.service.js';
import {
    ApplicationInstalledEvent,
    ApplicationLaunchedEvent,
    ApplicationUninstalledEvent,
} from '../event-bus/events/application.event.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import {
    ErrorReportingService,
    ReportServiceErrors,
    RuntimeErrorReporter,
} from '../runtime-error-manager/error-reporting.service.js';
import { SafeModeContext } from '../safe-mode/safe-mode-context.js';
import {
    InstallApplicationInputSchema,
    type ApplicationDefinition,
    type ApplicationMetadata,
} from '../schemas/applications.js';
import type { PersistedRecord } from '../schemas/persistence.js';
import { ApplicationInstanceManager } from './application-instance-manager.service.js';
import { LifecycleManager } from './helpers/lifecycle-manager.service.js';
import { Validator } from './helpers/validator.service.js';
import type { StateCollection } from './state.contract.js';
import { StateService } from './state.service.js';

@Injectable()
@ReportServiceErrors({ category: 'application' })
export class ApplicationManager extends ErrorReportingService {
    private readonly applications: StateCollection<ApplicationDefinition>;

    constructor(
        errorReporter: RuntimeErrorReporter,
        private readonly validator: Validator,
        private readonly stateService: StateService,
        private readonly eventBus: EventBus,
        private readonly configService: ConfigService,
        private readonly lifecycleManager: LifecycleManager,
        private readonly instanceManager: ApplicationInstanceManager,
        private readonly safeModeContext: SafeModeContext,
    ) {
        super(errorReporter);
        this.applications = this.stateService.collection('applications');
    }

    /**
     * @description
     * Validates and durably registers an application.
     * @throws {MarsaError} If the definition is invalid or safe mode is active.
     * @docsPage core/applications
     * @docsCategory Registry
     */
    public async install(definition: InstallApplicationInputSchema) {
        this.safeModeContext.assertAllowed('Application installation');
        this.validator.assertValidInput(
            InstallApplicationInputSchema,
            definition,
            'INVALID_APPLICATION',
            'Application definition',
        );

        const record: ApplicationDefinition = {
            ...definition,
            id: this.configService.identifierOptions.generator.generate('application'),
        };

        const foundApp = await this.applications.read(record.id);

        if (foundApp) {
            throw new MarsaError(
                'DUPLICATE_APPLICATION',
                `Application "${record.id}" is already registered.`,
            );
        }

        await this.applications.write(record.id, record, { durable: true, immediate: true });
        await this.eventBus.publish(new ApplicationInstalledEvent(record));

        return await this.getOne(record.id);
    }

    /**
     * @description
     * Removes an application that has no active instances.
     * @throws {MarsaError} If the application is active, missing, or safe mode is active.
     * @docsPage core/applications
     * @docsCategory Registry
     */
    public async uninstall(id: ApplicationId): Promise<void> {
        this.safeModeContext.assertAllowed('Application uninstallation');
        if (await this.instanceManager.hasForApplication(id)) {
            throw new MarsaError(
                'APPLICATION_IN_USE',
                `Application "${id}" cannot be removed while it has active instances.`,
            );
        }

        const foundApp = await this.getOne(id);
        if (!foundApp || !foundApp.value) {
            throw new MarsaError('APPLICATION_NOT_FOUND', `Application "${id}" cannot be found.`);
        }

        await this.applications.delete(foundApp.value.id);

        await this.eventBus.publish(new ApplicationUninstalledEvent(foundApp.value));
    }

    public async list(): Promise<[string, PersistedRecord<ApplicationDefinition>][]> {
        return (await this.applications.entries()).map(
            ([key, record]): [string, PersistedRecord<ApplicationDefinition>] => [key, record],
        );
    }

    public async getOne(id: ApplicationId): Promise<PersistedRecord<ApplicationDefinition> | undefined> {
        return this.applications.read(id);
    }

    public async getMetadata(id: ApplicationId): Promise<ApplicationMetadata | undefined> {
        const record = await this.getOne(id);

        if (!record) {
            return undefined;
        }

        const { id: applicationId, title, description, icon, policies, capabilities } = record.value;

        return Object.freeze({
            id: applicationId,
            title,
            ...(description === undefined ? {} : { description }),
            ...(icon === undefined ? {} : { icon }),
            policies,
            ...(capabilities === undefined ? {} : { capabilities }),
        });
    }

    /**
     * @description
     * Creates an instance or focuses the existing instance for a single-instance app. @link{ApplicationId}, @link{ApplicationInstanceId}.
     * @docsPage core/applications
     * @docsCategory Lifecycle
     * @example
     * ```ts
     * const instanceId = await kernel.launchApp(appId);
     * ```
     * @param appId Registered application to launch.
     * @returns The newly created or existing instance ID.
     * @throws {MarsaError} If the app is unknown, launch is cancelled, a new launch is blocked by safe mode, or the kernel is not initialized.
     */
    async launchApp(appId: ApplicationId): Promise<ApplicationInstanceId> {
        const application = await this.getOne(appId);
        if (!application) {
            throw new MarsaError('APPLICATION_NOT_FOUND', `Application "${appId}" is not registered.`);
        }

        const manager = this.instanceManager;
        const result = await manager.prepareCreate(appId, application.value.policies.instances);
        if (result.created) {
            try {
                this.safeModeContext.assertAllowed('Application launch');
                const lifecycleResult = await this.lifecycleManager.perform(
                    'onLaunch',
                    appId,
                    result.instance.id,
                    async () => {
                        await manager.commitCreate(result.instance.id);
                        return result.instance.id;
                    },
                );
                if (!lifecycleResult.completed) {
                    throw new MarsaError(
                        'LIFECYCLE_CANCELLED',
                        'Application launch was cancelled by a before hook.',
                    );
                }
            } catch (error) {
                manager.discardCreate(result.instance.id);
                throw error;
            }
        } else {
            await this.lifecycleManager.perform(
                'onFocus',
                result.instance.appId,
                result.instance.id,
                async () => {
                    await manager.requestFocus(result.instance.id);
                },
            );
        }

        const launchedInstance = await manager.get(result.instance.id);
        if (launchedInstance) {
            await this.eventBus.publish(
                new ApplicationLaunchedEvent(application.value, launchedInstance, result.created),
            );
        }
        return result.instance.id;
    }
}
