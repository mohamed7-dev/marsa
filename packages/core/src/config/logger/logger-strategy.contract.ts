export interface LoggerStrategy {
    info(message: string, context?: string): void;
    debug(message: string, context?: string): void;
    verbose(message: string, context?: string): void;
    warn(message: string, context?: string): void;
    error(message: string, context?: string, stack?: string): void;
}

export enum LogLevel {
    error = 0,
    warn = 1,
    info = 2,
    verbose = 3,
    debug = 4,
}
