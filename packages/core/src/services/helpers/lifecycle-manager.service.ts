import { MarsaError } from '../../common/errors/errors.js';
import { ConfigService } from '../../config/config.service.js';
import type {
    ApplicationId,
    ApplicationInstanceId,
} from '../../config/identifiers/identifier-generator.contract.js';
import { LogLevel } from '../../config/logger/logger-strategy.contract.js';
import { Injectable } from '../../infra/ioc-container/injectable.decorator.js';
import {
    ErrorReportingService,
    ReportServiceErrors,
    RuntimeErrorReporter,
} from '../../runtime-error-manager/error-reporting.service.js';
import { RuntimeErrorManager } from '../../runtime-error-manager/runtime-error-manager.service.js';
import { SafeModeContext } from '../../safe-mode/safe-mode-context.js';
import {
    LifecycleHookRegistrationSchema,
    LifecycleOperationInputSchema,
    type ApplicationLifecycleEvent,
    type LifecycleHook,
    type LifecycleHookContext,
    type LifecycleHookOptions,
} from '../../schemas/lifecycle.js';
import { Validator } from './validator.service.js';

/**
 * @description
 * Distinguishes committed values from cancellation.
 * @docsPage core/lifecycle
 * @docsCategory Types
 */
export type LifecycleOperation<Value> =
    | { readonly completed: true; readonly value: Value }
    | { readonly completed: false; readonly reason: 'cancelled' };

interface RegisteredHook {
    readonly event: ApplicationLifecycleEvent;
    readonly hook: LifecycleHook;
    readonly options: LifecycleHookOptions;
}

const SAFE_MODE_LIFECYCLE_EVENTS = new Set<ApplicationLifecycleEvent>([
    'onBlur',
    'onClose',
    'onFocus',
    'onPermissionRevoked',
    'onUnmount',
    'onVirtualize',
]);

@Injectable()
@ReportServiceErrors({ category: 'application' })
export class LifecycleManager extends ErrorReportingService {
    private readonly hooks: RegisteredHook[] = [];

    constructor(
        errorReporter: RuntimeErrorReporter,
        private readonly validator: Validator,
        private readonly errorManager: RuntimeErrorManager,
        private readonly configService: ConfigService,
        private readonly safeModeContext: SafeModeContext,
    ) {
        super(errorReporter);
    }
    /**
     * @description
     * Registers a new {@link LifecycleHook} for an application.
     *
     * :::info
     * - Preserves registration order and returns an idempotent unregister function.
     * - Throws {@link MarsaError} If a timeout is configured without a timer adapter.
     * :::
     * @docsPage core/lifecycle
     * @docsCategory Hooks
     * @example
     * ```ts
     * const unregister = lifecycle.register('onClose', { name: 'flush', before: flushState });
     * ```
     */
    public register(
        event: ApplicationLifecycleEvent,
        hook: LifecycleHook,
        options: LifecycleHookOptions = {},
    ): () => void {
        this.validator.assertValidInput(
            LifecycleHookRegistrationSchema,
            { event, hook, options },
            'INVALID_LIFECYCLE_HOOK',
            'Lifecycle hook registration',
        );

        if (options.timeoutMs !== undefined) {
            assertTimeout(options.timeoutMs);
            if (!this.configService.lifecycleOptions?.timer) {
                throw new MarsaError(
                    'LIFECYCLE_TIMER_UNAVAILABLE',
                    `Lifecycle hook "${hook.name}" configures a timeout but no timer adapter was provided.`,
                );
            }
        }

        const registered: RegisteredHook = { event, hook, options: Object.freeze({ ...options }) };
        this.hooks.push(registered);
        let active = true;
        return () => {
            if (active) {
                active = false;
                const index = this.hooks.indexOf(registered);
                if (index >= 0) {
                    this.hooks.splice(index, 1);
                }
            }
        };
    }

    /**
     * @description
     * Performs a {@link LifecycleHook}, and co-ordinates it with an operation.
     *
     * :::info
     * - Runs hooks in order and rolls back prepared hooks in reverse order on cancellation or failure.
     * - Throws {@link MarsaError} if the input is invalid, a hook failed during any phase, the operation failed, or safe mode blocks the lifecycle event.
     * :::
     *
     * @docsPage core/lifecycle
     * @docsCategory Operations
     * @example
     * ```ts
     * const result = await lifecycle.perform('onClose', appId, instanceId, closeInstance);
     * ```
     */
    public async perform<Value>(
        event: ApplicationLifecycleEvent,
        appId: ApplicationId,
        instanceId: ApplicationInstanceId,
        operation: () => Value | Promise<Value>,
    ): Promise<LifecycleOperation<Value>> {
        this.validator.assertValidInput(
            LifecycleOperationInputSchema,
            { event, appId, instanceId, operation },
            'INVALID_LIFECYCLE_HOOK',
            'Lifecycle operation',
        );
        if (this.safeModeContext.safeMode && !SAFE_MODE_LIFECYCLE_EVENTS.has(event)) {
            this.safeModeContext.assertAllowed(`Lifecycle event "${event}"`);
        }
        const correlationId = this.configService.identifierOptions.generator.generate('correlation');
        const context: LifecycleHookContext = Object.freeze({
            event,
            appId,
            instanceId,
            correlationId,
            timestamp: this.configService.timeOptions.provider.now(),
        });
        const participants = this.hooks.filter(entry => entry.event === event);
        const prepared: RegisteredHook[] = [];

        for (const entry of participants) {
            if (!entry.hook.before) {
                continue;
            }

            try {
                const result = await this.runBefore(entry, context);
                if (result === false) {
                    await this.rollback(prepared, context);
                    return { completed: false, reason: 'cancelled' };
                }
                prepared.push(entry);
            } catch (error) {
                this.reportHookFailure(entry, error, context, 'before');
                await this.rollback(prepared, context);
                if (error instanceof MarsaError) {
                    throw error;
                }
                throw new MarsaError(
                    'LIFECYCLE_HOOK_FAILED',
                    `Lifecycle before hook "${entry.hook.name}" failed during "${event}".`,
                    { cause: error },
                );
            }
        }

        let value: Value;
        try {
            value = await operation();
        } catch (error) {
            await this.rollback(prepared, context);
            throw error;
        }

        for (const entry of participants) {
            if (!entry.hook.after) {
                continue;
            }
            try {
                await entry.hook.after(context);
            } catch (error) {
                this.reportHookFailure(entry, error, context, 'after');
            }
        }

        return { completed: true, value };
    }

    private async runBefore(entry: RegisteredHook, context: LifecycleHookContext): Promise<boolean | void> {
        const before = entry.hook.before;
        if (!before) {
            return;
        }

        const timeoutMs = entry.options.timeoutMs ?? this.configService.lifecycleOptions?.defaultTimeoutMs;
        if (timeoutMs === undefined) {
            return before(context);
        }
        const timer = this.configService.lifecycleOptions?.timer;
        if (!timer) {
            throw new MarsaError(
                'LIFECYCLE_TIMER_UNAVAILABLE',
                `Lifecycle hook "${entry.hook.name}" requires a timer adapter.`,
            );
        }

        let cancelTimer = (): void => undefined;
        const timeout = new Promise<never>((_, reject) => {
            cancelTimer = timer.schedule(
                () =>
                    reject(
                        new MarsaError(
                            'LIFECYCLE_TIMEOUT',
                            `Lifecycle hook "${entry.hook.name}" timed out after ${timeoutMs} ms.`,
                        ),
                    ),
                timeoutMs,
            );
        });
        try {
            return await Promise.race([Promise.resolve().then(() => before(context)), timeout]);
        } finally {
            cancelTimer();
        }
    }

    private async rollback(
        prepared: readonly RegisteredHook[],
        context: LifecycleHookContext,
    ): Promise<void> {
        for (const entry of [...prepared].reverse()) {
            if (!entry.hook.rollback) {
                continue;
            }
            try {
                await entry.hook.rollback(context);
            } catch (error) {
                this.reportHookFailure(entry, error, context, 'rollback');
            }
        }
    }

    private reportHookFailure(
        entry: RegisteredHook,
        error: unknown,
        context: LifecycleHookContext,
        phase: 'before' | 'after' | 'rollback',
    ): void {
        const timedOut = error instanceof MarsaError && error.code === 'LIFECYCLE_TIMEOUT';
        this.errorManager.capture(error, {
            category: entry.options.errorCategory ?? 'application',
            code: timedOut ? 'LIFECYCLE_TIMEOUT' : `LIFECYCLE_${phase.toUpperCase()}_HOOK_FAILED`,
            source: entry.hook.name,
            message: `Lifecycle ${phase} hook "${entry.hook.name}" failed during "${context.event}".`,
            severity: timedOut ? LogLevel.warn : LogLevel.error,
            recoverable: true,
            correlationId: context.correlationId,
            appId: context.appId,
            instanceId: context.instanceId,
        });
    }
}

function assertTimeout(timeoutMs: number): void {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new RangeError('Lifecycle hook timeout must be a positive finite number.');
    }
}
