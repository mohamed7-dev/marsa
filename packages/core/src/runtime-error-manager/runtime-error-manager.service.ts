import { MarsaError } from '../common/errors/errors.js';
import { ConfigService } from '../config/config.service.js';
import type {
    ApplicationId,
    ApplicationInstanceId,
    CorrelationId,
} from '../config/identifiers/identifier-generator.contract.js';
import { LogLevel } from '../config/logger/logger-strategy.contract.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import { Logger } from '../logger/logger.js';
import { SafeModeContext } from '../safe-mode/safe-mode-context.js';
import type {
    RuntimeError,
    RuntimeErrorCategory,
    RuntimeErrorRecord,
    RuntimeErrorSeverity,
} from './types.js';

/**
 * @description
 * The context object that should be passed along with an error to report.
 * @docsPage core/errors
 * @docsCategory Reporting
 */
export interface RuntimeErrorContext {
    /**
     * @description
     * Names the {@link RuntimeErrorCategory}.
     */
    readonly category: RuntimeErrorCategory;
    /**
     * @description
     * Identifies this failure for programmatic handling.
     */
    readonly code: string;
    /**
     * @description
     * Identifies the diagnostic source.
     */
    readonly source: string;
    /**
     * @description
     * Replaces the default generic category message.
     */
    readonly message?: string;
    /**
     * @description
     * Names the {@link RuntimeErrorSeverity}.
     * Defaults according to the error category.
     */
    readonly severity?: RuntimeErrorSeverity;
    /**
     * @description
     * Defaults to non-recoverable only for fatal errors.
     */
    readonly recoverable?: boolean;
    /**
     * @description
     * Associates this error with an existing operation.
     */
    readonly correlationId?: CorrelationId;
    /**
     * @description
     * Associates the error with an application.
     */
    readonly appId?: ApplicationId;
    /**
     * @description
     * Associates the error with an application instance.
     */
    readonly instanceId?: ApplicationInstanceId;
}

/**
 * @description
 * Normalizes, deduplicates, logs, and applies runtime-wide fatal error handling.
 * @docsPage core/errors
 * @docsCategory Services
 */
@Injectable()
export class RuntimeErrorManager {
    private readonly capturedErrors = new WeakMap<object, RuntimeErrorRecord>();

    constructor(
        private readonly configService: ConfigService,
        private readonly safeModeContext: SafeModeContext,
    ) {}
    /**
     * @description
     * Given a {@link RuntimeError}, It:
     * - Normalizes it into a {@link RuntimeErrorRecord}.
     * - Logs it through the configured logger.
     * @docsPage core/errors
     * @docsCategory Reporting
     */
    public report(error: RuntimeError): void {
        this.append(
            Object.freeze({
                ...error,
                code: error.name,
                severity: error.category === 'fatal' ? LogLevel.error : LogLevel.warn,
                source: error.category,
                recoverable: error.category !== 'fatal',
            }),
        );
    }

    /**
     * @description
     * Given an unknown error, and a {@link RuntimeErrorContext} It:
     * - Normalizes it into a {@link RuntimeErrorRecord}.
     * - Logs it through the configured logger.
     * - Avoids logging the same error or an already-reported cause more than once.
     * - Returns the {@link RuntimeErrorRecord}
     * @docsPage core/errors
     * @docsCategory Reporting
     * @example
     * ```ts
     * const record = runtimeErrorManager.capture(error, { category: 'application', code: 'APP_FAILED', source: 'loader' });
     * ```
     */
    public capture(error: unknown, context: RuntimeErrorContext): RuntimeErrorRecord {
        if (context.category === 'fatal') {
            this.safeModeContext.enter();
        }
        const existingRecord = this.findCapturedCause(error);
        if (existingRecord) {
            return existingRecord;
        }

        const record: RuntimeErrorRecord = Object.freeze({
            category: context.category,
            name: error instanceof Error ? error.name : 'UnknownError',
            message:
                context.message ??
                (error instanceof Error ? error.message : `A ${context.category} runtime error occurred.`),
            correlationId:
                context.correlationId ??
                this.configService.identifierOptions.generator.generate('correlation'),
            timestamp: this.configService.timeOptions.provider.now(),
            code: error instanceof MarsaError ? error.code : context.code,
            severity: context.severity ?? (error instanceof MarsaError ? error.logLevel : LogLevel.error),
            source: context.source,
            recoverable: context.recoverable ?? context.category !== 'fatal',
            ...(context.appId === undefined ? {} : { appId: context.appId }),
            ...(context.instanceId === undefined ? {} : { instanceId: context.instanceId }),
            ...(error === undefined ? {} : { cause: error }),
        });
        this.append(record);
        if (isObject(error)) {
            this.capturedErrors.set(error, record);
        }
        return record;
    }

    private findCapturedCause(error: unknown): RuntimeErrorRecord | undefined {
        if (!isObject(error)) {
            return undefined;
        }

        return this.findCapturedCauseInObject(error, new WeakSet());
    }

    private findCapturedCauseInObject(
        error: object,
        visited: WeakSet<object>,
    ): RuntimeErrorRecord | undefined {
        if (visited.has(error)) {
            return undefined;
        }
        visited.add(error);

        const directRecord = this.capturedErrors.get(error);
        if (directRecord) {
            return directRecord;
        }

        if (error instanceof AggregateError) {
            for (const nestedError of error.errors) {
                const nestedRecord = isObject(nestedError)
                    ? this.findCapturedCauseInObject(nestedError, visited)
                    : undefined;
                if (nestedRecord) {
                    this.capturedErrors.set(error, nestedRecord);
                    return nestedRecord;
                }
            }
        }

        const cause = Reflect.get(error, 'cause');
        if (isObject(cause)) {
            const causeRecord = this.findCapturedCauseInObject(cause, visited);
            if (causeRecord) {
                this.capturedErrors.set(error, causeRecord);
                return causeRecord;
            }
        }

        return undefined;
    }

    private append(record: RuntimeErrorRecord): void {
        if (record.category === 'fatal') {
            this.safeModeContext.enter();
        }
        const details = JSON.stringify({
            category: record.category,
            code: record.code,
            source: record.source,
            correlationId: record.correlationId,
        });
        const stack = record.cause instanceof Error ? record.cause.stack : undefined;
        Logger.error(`${record.message} ${details}`, record.source, stack);
    }
}

function isObject(value: unknown): value is object {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
