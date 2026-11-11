import pc from 'picocolors';
import { type LoggerStrategy, LogLevel } from './logger-strategy.contract.js';

export const DEFAULT_CONTEXT = 'Marsa';

interface StdoutLoggerOptions {
    logLevel?: LogLevel;
}

export class StdoutLoggerStrategy implements LoggerStrategy {
    public logLevel = LogLevel.info;
    private _colors = this._colorize();
    private _defaultContext = DEFAULT_CONTEXT;

    constructor(options?: StdoutLoggerOptions) {
        this.logLevel = options?.logLevel ?? LogLevel.info;
    }

    info(message: string, context?: string): void {
        if (this.logLevel >= LogLevel.info) {
            this._writeToStdout(
                this._colors.info('info'),
                this._getTimestamp(),
                this._stringify(message),
                this._getContext(context),
            );
        }
    }
    debug(message: string, context?: string): void {
        if (this.logLevel >= LogLevel.debug) {
            this._writeToStdout(
                this._colors.debug('debug'),
                this._getTimestamp(),
                this._stringify(message),
                this._getContext(context),
            );
        }
    }
    verbose(message: string, context?: string): void {
        if (this.logLevel >= LogLevel.verbose) {
            this._writeToStdout(
                this._colors.verbose('verbose'),
                this._getTimestamp(),
                this._stringify(message),
                this._getContext(context),
            );
        }
    }
    warn(message: string, context?: string): void {
        if (this.logLevel >= LogLevel.warn) {
            this._writeToStdout(
                this._colors.warn('warn'),
                this._getTimestamp(),
                this._stringify(message),
                this._getContext(context),
            );
        }
    }
    error(message: string, context?: string, stack?: string): void {
        if (this.logLevel >= LogLevel.error) {
            this._writeToStdout(
                this._colors.error('error'),
                this._getTimestamp(),
                this._colors.error(
                    stack ? `${this._stringify(message)}\n${stack}` : this._stringify(message),
                ),
                this._getContext(context),
            );
        }
    }

    public set defaultContext(defaultContext: string) {
        this._defaultContext = defaultContext;
    }

    public get defaultContext() {
        return this._defaultContext;
    }

    private _writeToStdout(prefix: string, timestamp: string, message: string, context?: string) {
        // Log Message Would Construction -> prefix, timestamp, context, message, <new line>
        console.log([prefix, timestamp, context, message, '\n'].join(' '));
    }

    private _getTimestamp() {
        const timestamp = new Date().toLocaleDateString(undefined, {
            year: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
            day: 'numeric',
            month: 'numeric',
        });
        return this._colors.timestamp(timestamp + ' -');
    }

    private _colorize() {
        return {
            info: (input: string | number) => pc.blue(input),
            debug: (input: string | number) => pc.magenta(input),
            verbose: (input: string | number) => pc.magenta(input),
            warn: (input: string | number) => pc.yellow(input),
            error: (input: string | number) => pc.red(input),
            context: (input: string | number) => pc.cyan(input),
            timestamp: (input: string | number) => pc.gray(input),
        };
    }

    private _stringify(input: string | object): string {
        return typeof input === 'string' ? input : JSON.stringify(input, null, 2);
    }

    private _getContext(context?: string) {
        return this._colors.context(`[${context || this.defaultContext}]`);
    }
}
