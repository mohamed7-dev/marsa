import type {
    ApplicationId,
    ApplicationInstanceId,
} from '../../config/identifiers/identifier-generator.contract.js';
import type { ApplicationInstance, ApplicationInstanceStatus } from '../../schemas/applications.js';
import { MarsaEvent } from '../marsa-event.js';

/**
 * @description
 * Indicates that an application instance became active in the runtime.
 * @docsPage core/events
 * @docsCategory Application Instances
 */
export class ApplicationInstanceCreatedEvent extends MarsaEvent {
    /**
     * @description
     * The committed application instance.
     */
    public readonly instance: ApplicationInstance;

    constructor(instance: ApplicationInstance) {
        super();
        this.instance = instance;
    }
}

/**
 * @description
 * Indicates that an application instance changed lifecycle status.
 * @docsPage core/events
 * @docsCategory Application Instances
 */
export class ApplicationInstanceStatusChangedEvent extends MarsaEvent {
    /**
     * @description
     * The instance record before the status change.
     */
    public readonly previous: ApplicationInstance;

    /**
     * @description
     * The instance record after the status change.
     */
    public readonly current: ApplicationInstance;

    /**
     * @description
     * The lifecycle status reached by the instance.
     */
    public readonly status: ApplicationInstanceStatus;

    constructor(previous: ApplicationInstance, current: ApplicationInstance) {
        super();
        this.previous = previous;
        this.current = current;
        this.status = current.status;
    }
}

/**
 * @description
 * Indicates that an application instance was removed from the runtime.
 * @docsPage core/events
 * @docsCategory Application Instances
 */
export class ApplicationInstanceDestroyedEvent extends MarsaEvent {
    /**
     * @description
     * The terminal instance record.
     */
    public readonly instance: ApplicationInstance;

    /**
     * @description
     * Identifies the destroyed instance.
     */
    public readonly instanceId: ApplicationInstanceId;

    constructor(instance: ApplicationInstance) {
        super();
        this.instance = instance;
        this.instanceId = instance.id;
    }
}

/**
 * @description
 * Indicates that an existing application instance was asked to receive focus.
 * @docsPage core/events
 * @docsCategory Application Instances
 */
export class ApplicationInstanceFocusRequestedEvent extends MarsaEvent {
    /**
     * @description
     * Identifies the application that owns the instance.
     */
    public readonly appId: ApplicationId;

    /**
     * @description
     * Identifies the instance that should receive focus.
     */
    public readonly instanceId: ApplicationInstanceId;

    constructor(appId: ApplicationId, instanceId: ApplicationInstanceId) {
        super();
        this.appId = appId;
        this.instanceId = instanceId;
    }
}
