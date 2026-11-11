import type { ClassType } from '../common/types/utils.js';
import type { DeveloperCapabilityGrant } from '../schemas/permissions.js';
import type { StateMigration, StateServiceOptions } from '../schemas/persistence.js';
import type { IdentifierGeneratorStrategy } from './identifiers/identifier-generator.contract.js';
import type { LifecycleTimerStrategy } from './lifecycle/lifecycle.contract.js';
import type { LoggerStrategy } from './logger/logger-strategy.contract.js';
import type { PersistenceAdapterStrategy } from './persistence/persistence-adapter.contract.js';
import type { TimeProviderStrategy } from './time/time-provider.contract.js';

interface PersistenceOptions {
    adapter?: PersistenceAdapterStrategy;
}

interface TimeOptions {
    provider?: TimeProviderStrategy;
}

interface IdentifierOptions {
    generator?: IdentifierGeneratorStrategy;
}

interface LifecycleOptions {
    timer?: LifecycleTimerStrategy;
    defaultTimeoutMs?: number;
}

interface LifecycleOptions {
    timer?: LifecycleTimerStrategy;
    defaultTimeoutMs?: number;
}

interface PermissionOptions {
    developerGrants?: DeveloperCapabilityGrant[];
}

interface LoggerOptions {
    strategy?: LoggerStrategy;
}

/**
 * @description
 * Configures defaults for generic named state collections.
 * @docsPage core/configuration
 * @docsCategory Options
 */
export interface StateOptions {
    /**
     * @description
     * Persists named state collections with the configured adapter; defaults to `true`.
     * @docsPage core/configuration
     * @docsCategory Options
     */
    persistenceEnabled?: boolean;
    /**
     * @description
     * Current schema version for persisted values; defaults to `1`.
     * @docsPage core/configuration
     * @docsCategory Options
     */
    schemaVersion?: number;
    /**
     * @description
     * Default write debounce in milliseconds; defaults to `300`.
     * @docsPage core/configuration
     * @docsCategory Options
     */
    debounceMs?: number;
    /**
     * @description
     * Adjacent schema-version transformations used when restoring collection values.
     * @docsPage core/configuration
     * @docsCategory Options
     */
    migrations?: readonly StateMigration<unknown>[];
    /**
     * @description
     * Receives structured failures from state persistence.
     * @docsPage core/configuration
     * @docsCategory Options
     */
    onPersistenceError?: StateServiceOptions['onPersistenceError'];
}

export interface MarsaConfig {
    persistenceOptions?: PersistenceOptions;
    /**
     * @description
     * Controls persistence of generic named state collections.
     * @docsPage core/configuration
     * @docsCategory Options
     */
    stateOptions?: StateOptions;
    timeOptions?: TimeOptions;
    identifierOptions?: IdentifierOptions;
    lifecycleOptions?: LifecycleOptions;
    permissionOptions?: PermissionOptions;
    loggerOptions?: LoggerOptions;
    /**
     * @description
     * An array of plugins.
     *
     * @default []
     */
    plugins?: Array<ClassType<any>>;
}

export type RuntimeMarsaConfigOptions = Required<
    Omit<MarsaConfig, 'lifecycleOptions' | 'permissionOptions' | 'stateOptions'>
> & {
    persistenceOptions: Required<PersistenceOptions>;
    stateOptions: StateOptions &
        Required<Pick<StateOptions, 'persistenceEnabled' | 'schemaVersion' | 'debounceMs' | 'migrations'>>;
    timeOptions: Required<TimeOptions>;
    identifierOptions: Required<IdentifierOptions>;
    loggerOptions: Required<LoggerOptions>;
    lifecycleOptions?: Partial<LifecycleOptions>;
    permissionOptions?: Partial<PermissionOptions>;
};

export type PartialMarsaConfigOptions = Partial<MarsaConfig>;
