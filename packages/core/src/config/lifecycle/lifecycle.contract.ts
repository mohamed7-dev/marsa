import z from 'zod';

export interface LifecycleTimerStrategy {
    schedule(callback: () => void, delayMs: number): () => void;
}

/**
 * @description
 * Validates the contract of the host provided {@link LifecycleTimerStrategy}.
 * @docsPage core/lifecycle
 * @docsCategory Contracts
 */
export const LifecycleTimerStrategySchema = z.custom<LifecycleTimerStrategy>(
    value =>
        typeof value === 'object' &&
        value !== null &&
        'schedule' in value &&
        typeof value.schedule === 'function',
    { message: 'Expected a lifecycle timer with a schedule function.' },
);
