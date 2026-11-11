import type { ApplicationDefinition, ApplicationInstance } from '../../schemas/applications.js';
import { MarsaEvent } from '../marsa-event.js';

/**
 * @description
 * Indicates that an application definition was installed.
 * @docsPage core/events
 * @docsCategory Applications
 */
export class ApplicationInstalledEvent extends MarsaEvent {
    /**
     * @description
     * The installed application definition.
     */
    public readonly application: ApplicationDefinition;

    constructor(application: ApplicationDefinition) {
        super();
        this.application = application;
    }
}

/**
 * @description
 * Indicates that an application definition was uninstalled.
 * @docsPage core/events
 * @docsCategory Applications
 */
export class ApplicationUninstalledEvent extends MarsaEvent {
    /**
     * @description
     * The application definition that was removed.
     */
    public readonly application: ApplicationDefinition;

    constructor(application: ApplicationDefinition) {
        super();
        this.application = application;
    }
}

/**
 * @description
 * Indicates that an application launch completed successfully.
 * @docsPage core/events
 * @docsCategory Applications
 */
export class ApplicationLaunchedEvent extends MarsaEvent {
    /**
     * @description
     * The application definition that was launched.
     */
    public readonly application: ApplicationDefinition;

    /**
     * @description
     * The instance used by the completed launch.
     */
    public readonly instance: ApplicationInstance;

    /**
     * @description
     * Indicates whether the launch created a new instance or reused the existing one.
     */
    public readonly created: boolean;

    constructor(application: ApplicationDefinition, instance: ApplicationInstance, created: boolean) {
        super();
        this.application = application;
        this.instance = instance;
        this.created = created;
    }
}
