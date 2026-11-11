/* eslint-disable @typescript-eslint/no-unused-vars */

import type { LoggerStrategy } from './logger-strategy.contract.js';

/**
 * A logger that does not log.
 */
export class NoopLogger implements LoggerStrategy {
    debug(message: string, context?: string): void {
        // noop!
    }

    error(message: string, context?: string, trace?: string): void {
        // noop!
    }

    info(message: string, context?: string): void {
        // noop!
    }

    verbose(message: string, context?: string): void {
        // noop!
    }

    warn(message: string, context?: string): void {
        // noop!
    }
}
