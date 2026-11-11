import type { TimeProviderStrategy } from './time-provider.contract.js';

export class DefaultTimeProviderStrategy implements TimeProviderStrategy {
    public now(): number {
        return Date.now();
    }
}
