import { MarsaError } from '../common/errors/errors.js';
import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import type { RuntimeErrorContext } from './runtime-error-manager.service.js';
import { RuntimeErrorManager } from './runtime-error-manager.service.js';
import type { RuntimeErrorCategory, RuntimeErrorRecord } from './types.js';

const ERROR_REPORTER = Symbol('ERROR_REPORTER');

interface ReportServiceErrorsOptions {
    readonly category: RuntimeErrorCategory;
}

type ServiceMethod = (this: object, ...args: unknown[]) => unknown;

@Injectable()
export class RuntimeErrorReporter {
    constructor(private readonly errorManager: RuntimeErrorManager) {}

    /**
     * @description
     * Reports a service failure through the shared {@link RuntimeErrorManager}.
     */
    public report(error: unknown, context: RuntimeErrorContext): RuntimeErrorRecord {
        return this.errorManager.capture(error, context);
    }
}

/**
 * @description
 * Supplies the shared reporter to services instrumented by {@link ReportServiceErrors}.
 */
export abstract class ErrorReportingService {
    protected constructor(reporter: RuntimeErrorReporter) {
        Object.defineProperty(this, ERROR_REPORTER, {
            configurable: false,
            enumerable: false,
            value: reporter,
            writable: false,
        });
    }
}

/**
 * @description
 * Reports synchronous and asynchronous service method failures once, then rethrows them unchanged.
 */
export function ReportServiceErrors(options: ReportServiceErrorsOptions): ClassDecorator {
    return target => {
        for (const methodName of Object.getOwnPropertyNames(target.prototype)) {
            if (methodName === 'constructor') {
                continue;
            }

            const descriptor = Object.getOwnPropertyDescriptor(target.prototype, methodName);
            if (!descriptor || typeof descriptor.value !== 'function') {
                continue;
            }

            const original = descriptor.value as ServiceMethod;
            descriptor.value = function (this: object, ...args: unknown[]): unknown {
                const source = `${target.name}.${methodName}`;
                const reportAndRethrow = (error: unknown): never => {
                    try {
                        const reporter = Reflect.get(this, ERROR_REPORTER) as RuntimeErrorReporter;
                        reporter.report(error, {
                            category: options.category,
                            code: error instanceof MarsaError ? error.code : 'SERVICE_OPERATION_FAILED',
                            source,
                            message: `Service operation "${source}" failed.`,
                            ...(error instanceof MarsaError ? { severity: error.logLevel } : {}),
                        });
                    } catch (reportingError) {
                        throw new AggregateError(
                            [error, reportingError],
                            `Service operation "${source}" failed and its error could not be reported.`,
                            { cause: reportingError },
                        );
                    }

                    throw error;
                };

                let result: unknown;
                try {
                    result = original.apply(this, args);
                } catch (error) {
                    return reportAndRethrow(error);
                }

                let resultIsPromiseLike: boolean;
                try {
                    resultIsPromiseLike = isPromiseLike(result);
                } catch (error) {
                    return reportAndRethrow(error);
                }

                if (resultIsPromiseLike) {
                    return Promise.resolve(result).catch(reportAndRethrow);
                }

                return result;
            };
            Object.defineProperty(target.prototype, methodName, descriptor);
        }
    };
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        ((typeof value === 'object' && value !== null) || typeof value === 'function') &&
        typeof Reflect.get(value, 'then') === 'function'
    );
}
