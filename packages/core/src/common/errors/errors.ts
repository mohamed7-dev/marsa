import { LogLevel } from '../../config/logger/logger-strategy.contract.js';

/**
 * @description
 * Lets integrations handle expected runtime failures without matching messages. @link{MarsaError}.
 * @docsPage core/errors
 * @docsCategory Types
 * @example
 * ```ts
 * if (error.code === 'PERMISSION_DENIED') showAccessError();
 * ```
 */
export type MarsaErrorCode =
    | 'DUPLICATE_APPLICATION'
    | 'INVALID_APPLICATION'
    // | 'INVALID_KERNEL_OPTIONS'
    | 'INVALID_CONFIG_OPTIONS'
    | 'INVALID_LIFECYCLE_HOOK'
    | 'INVALID_PERMISSION_GRANT'
    | 'INVALID_STATE_CONFIGURATION'
    | 'APPLICATION_NOT_FOUND'
    | 'INSTANCE_NOT_FOUND'
    | 'INVALID_INSTANCE_TRANSITION'
    | 'INSTANCE_EXISTS'
    | 'APPLICATION_IN_USE'
    | 'INVALID_KERNEL_STATE'
    | 'IDENTIFIER_COLLISION'
    | 'LIFECYCLE_CANCELLED'
    | 'LIFECYCLE_TIMEOUT'
    | 'LIFECYCLE_TIMER_UNAVAILABLE'
    | 'LIFECYCLE_HOOK_FAILED'
    | 'SAFE_MODE'
    | 'PERMISSION_DENIED'
    | 'EVENT_NOT_ALLOWED'
    | 'INVALID_EVENT'
    | 'INVALID_PERSISTENCE_ADAPTER'
    | 'PERSISTENCE_READ_FAILED'
    | 'PERSISTENCE_WRITE_FAILED'
    | 'PERSISTENCE_DELETE_FAILED'
    | 'PERSISTENCE_FLUSH_FAILED'
    | 'PERSISTENCE_MIGRATION_FAILED';

/**
 * @description
 * Provides a typed code for host integrations and diagnostics. @link{MarsaErrorCode}.
 * @docsPage core/errors
 * @docsCategory Errors
 * @example
 * ```ts
 * throw new MarsaError('APPLICATION_NOT_FOUND', 'Application is not registered.');
 * ```
 */
export class MarsaError extends Error {
    /**
     * @description
     * Identifies the expected failure category. @link{MarsaErrorCode}.
     * @docsPage core/errors
     * @docsCategory Errors
     * @example
     * ```ts
     * error.code === 'INVALID_EVENT'
     * ```
     */
    readonly code: MarsaErrorCode;

    /**
     * @description
     * Sets a stable code, safe message, and optional underlying cause. @link{MarsaErrorCode}.
     * @docsPage core/errors
     * @docsCategory Errors
     * @example
     * ```ts
     * new MarsaError('INVALID_EVENT', 'Event type is required.');
     * ```
     * @param code Stable machine-readable error code.
     * @param message Safe human-readable message.
     * @param logLevel The log level of the error.
     * @param options Optional standard error cause.
     */
    constructor(
        code: MarsaErrorCode,
        message: string,
        logLevelOrOptions: LogLevel | ErrorOptions = LogLevel.error,
        options?: ErrorOptions,
    ) {
        super(message, typeof logLevelOrOptions === 'number' ? options : logLevelOrOptions);
        this.code = code;
        this.logLevel = typeof logLevelOrOptions === 'number' ? logLevelOrOptions : LogLevel.error;
        this.name = 'MarsaError';
    }

    readonly logLevel: LogLevel;
}
