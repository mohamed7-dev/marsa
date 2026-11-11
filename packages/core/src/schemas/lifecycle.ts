import { z } from 'zod';
import { ApplicationIdSchema, ApplicationInstanceIdSchema, CorrelationIdSchema } from './identifiers.js';

// keep

// Lifecycle Events
export const ApplicationLifecycleEventSchema = z.enum([
    'onLaunch',
    'onMount',
    'onUnmount',
    'onVirtualize',
    'onRestore',
    'onMinimize',
    'onMaximize',
    'onFocus',
    'onBlur',
    'onClose',
    'onWorkspaceChange',
    'onPermissionRevoked',
]);
export type ApplicationLifecycleEvent = z.infer<typeof ApplicationLifecycleEventSchema>;

// Hook Context
export const LifecycleHookContextSchema = z
    .object({
        event: ApplicationLifecycleEventSchema,
        appId: ApplicationIdSchema,
        instanceId: ApplicationInstanceIdSchema,
        correlationId: CorrelationIdSchema,
        timestamp: z.number(),
    })
    .strict()
    .readonly();

export type LifecycleHookContext = z.infer<typeof LifecycleHookContextSchema>;

// Hook
type BeforeLifecycleCallback = (context: LifecycleHookContext) => boolean | void | Promise<boolean | void>;
type LifecycleCallback = (context: LifecycleHookContext) => void | Promise<void>;

const beforeLifecycleCallback = z.custom<BeforeLifecycleCallback>(value => typeof value === 'function', {
    message: 'Expected a lifecycle callback function.',
});

const lifecycleCallback = z.custom<LifecycleCallback>(value => typeof value === 'function', {
    message: 'Expected a lifecycle callback function.',
});

export const LifecycleHookSchema = z
    .object({
        name: z.string().refine(value => value.trim().length > 0),
        before: beforeLifecycleCallback.optional(),
        rollback: lifecycleCallback.optional(),
        after: lifecycleCallback.optional(),
    })
    .strict()
    .readonly();

export type LifecycleHook = z.infer<typeof LifecycleHookSchema>;

// Timer

export const LifecycleTimerSchema = z
    .object({
        schedule: z.custom<(callback: () => void, delayMs: number) => () => void>(
            value => typeof value === 'function',
        ),
    })
    .strict()
    .readonly();
export type LifecycleTimer = z.infer<typeof LifecycleTimerSchema>;

export const LifecycleHookOptionsSchema = z
    .object({
        timeoutMs: z.number().positive().optional(),
        errorCategory: z.enum(['application', 'integration', 'kernel', 'fatal']).optional(),
    })
    .strict()
    .readonly();
export type LifecycleHookOptions = z.infer<typeof LifecycleHookOptionsSchema>;

// Lifecycle Manager

export const LifecycleHookRegistrationSchema = z
    .object({
        event: ApplicationLifecycleEventSchema,
        hook: LifecycleHookSchema,
        options: LifecycleHookOptionsSchema.optional(),
    })
    .strict();

export const LifecycleOperationInputSchema = z
    .object({
        event: ApplicationLifecycleEventSchema,
        appId: ApplicationIdSchema,
        instanceId: ApplicationInstanceIdSchema,
        operation: z.custom<() => unknown>(value => typeof value === 'function'),
    })
    .strict();
