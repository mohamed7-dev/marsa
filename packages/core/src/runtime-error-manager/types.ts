import type {
    ApplicationId,
    ApplicationInstanceId,
    CorrelationId,
} from '../config/identifiers/identifier-generator.contract.js';
import type { LogLevel } from '../config/logger/logger-strategy.contract.js';

/**
 * @description
 * Classifies application, integration, kernel, and fatal errors.
 * @docsPage core/errors
 * @docsCategory Types
 */
export type RuntimeErrorCategory = 'application' | 'integration' | 'kernel' | 'fatal';

/**
 * @description
 * This interface defines the contract of a runtime error.
 * It provides categorized diagnostics without exposing raw exceptions.
 * @docsPage core/errors
 * @docsCategory Contracts
 */
export interface RuntimeError {
    /**
     * @description
     * Classifies the source and recovery boundary.
     */
    readonly category: RuntimeErrorCategory;
    /**
     * @description
     * Identifies the exception class without exposing its raw details.
     */
    readonly name: string;
    /**
     * @description
     * Summarizes the failure for runtime handling.
     */
    readonly message: string;
    /**
     * @description
     * Connects records from the same operation.
     */
    readonly correlationId: CorrelationId;
    /**
     * @description
     * Records when the error was captured.
     */
    readonly timestamp: number;
    /**
     * @description
     * Identifies the application involved in the failure.
     */
    readonly appId?: ApplicationId;
    /**
     * @description
     * Identifies the application instance involved.
     */
    readonly instanceId?: ApplicationInstanceId;
}

/**
 * @description
 * Indicates the operational urgency of a diagnostic.
 * @docsPage core/errors
 * @docsCategory Types
 */
export type RuntimeErrorSeverity = LogLevel;

/**
 * @description
 * An internal representation of the {@link RuntimeError}.
 * it adds codes, source, recovery metadata, and diagnostic-only cause to a runtime error.
 * @docsPage core/errors
 * @docsCategory Contracts
 */
export interface RuntimeErrorRecord extends RuntimeError {
    /**
     * @description
     * Identifies the failure for programmatic handling.
     */
    readonly code: string;
    /**
     * @description
     * Indicates operational urgency.
     */
    readonly severity: RuntimeErrorSeverity;
    /**
     * @description
     * Identifies the reporting source.
     */
    readonly source: string;
    /**
     * @description
     * Reports the runtime's recovery expectation.
     */
    readonly recoverable: boolean;
    /**
     * @description
     * Preserves the cause without making it part of the safe user-facing message.
     */
    readonly cause?: unknown;
}
