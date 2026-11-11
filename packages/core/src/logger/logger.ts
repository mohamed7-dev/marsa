import type { LoggerStrategy } from '../config/logger/logger-strategy.contract.js';

/**
 * @description
 * This class is responsible for handling all the logging throughout the application.
 **/
export class Logger {
    private static _logger: LoggerStrategy;

    static get logger(): LoggerStrategy {
        return this._logger;
    }

    static useLogger(logger: LoggerStrategy) {
        Logger._logger = logger;
    }

    static info(message: string, context?: string) {
        Logger.logger.info(message, context);
    }
    static debug(message: string, context?: string) {
        Logger.logger.debug(message, context);
    }
    static warn(message: string, context?: string) {
        Logger.logger.warn(message, context);
    }
    static verbose(message: string, context?: string) {
        Logger.logger.verbose(message, context);
    }
    static error(message: string, context?: string, trace?: string): void {
        Logger.logger.error(message, context, trace);
    }
}
