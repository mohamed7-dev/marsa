import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { MarsaError } from '../src/common/errors/errors.js';
import { getConfig, resetConfig } from '../src/config/config-utils.js';
import type { ConfigService } from '../src/config/config.service.js';
import type { LoggerStrategy } from '../src/config/logger/logger-strategy.contract.js';
import { EntryModule } from '../src/entry.module.js';
import { IocContainer } from '../src/infra/ioc-container/ioc-container.js';
import { Module } from '../src/infra/ioc-container/module.decorator.js';
import { Logger } from '../src/logger/logger.js';
import { PluginCommonModule } from '../src/plugins/plugin-common.modules.js';
import {
    ErrorReportingService,
    ReportServiceErrors,
    RuntimeErrorReporter,
} from '../src/runtime-error-manager/error-reporting.service.js';
import {
    RuntimeErrorManager,
    type RuntimeErrorContext,
} from '../src/runtime-error-manager/runtime-error-manager.service.js';
import type { RuntimeErrorRecord } from '../src/runtime-error-manager/types.js';
import { SafeModeContext } from '../src/safe-mode/safe-mode-context.js';
import { ApplicationManager } from '../src/services/application.service.js';

class PluginErrorConsumer {
    constructor(readonly runtimeErrorManager: RuntimeErrorManager) {}
}

class RuntimeErrorPluginModule {}

Module({
    imports: [PluginCommonModule],
    providers: [
        {
            provide: PluginErrorConsumer,
            useFactory: (manager: RuntimeErrorManager) => new PluginErrorConsumer(manager),
            inject: [RuntimeErrorManager],
        },
    ],
})(RuntimeErrorPluginModule);

function createService() {
    const capture = vi.fn((): RuntimeErrorRecord => ({}) as RuntimeErrorRecord);
    const manager = { capture } as unknown as RuntimeErrorManager;
    const reporter = new RuntimeErrorReporter(manager);

    class TestService extends ErrorReportingService {
        constructor() {
            super(reporter);
        }

        failSynchronously(error: unknown): never {
            throw error;
        }

        failAsynchronously(error: unknown): Promise<never> {
            return Promise.reject(error);
        }
    }

    ReportServiceErrors({ category: 'application' })(TestService);
    return { service: new TestService(), capture };
}

describe('ReportServiceErrors', () => {
    it('reports a synchronous service failure and rethrows the original error', () => {
        const { service, capture } = createService();
        const error = new MarsaError('APPLICATION_NOT_FOUND', 'Application is missing.');

        expect(() => service.failSynchronously(error)).toThrow(error);
        expect(capture).toHaveBeenCalledOnce();
        expect(capture).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                category: 'application',
                code: 'APPLICATION_NOT_FOUND',
                source: 'TestService.failSynchronously',
            }),
        );
    });

    it('reports an asynchronous service failure and rethrows the original error', async () => {
        const { service, capture } = createService();
        const error = new Error('Persistence failed.');

        await expect(service.failAsynchronously(error)).rejects.toBe(error);
        expect(capture).toHaveBeenCalledOnce();
        expect(capture).toHaveBeenCalledWith(
            error,
            expect.objectContaining({
                category: 'application',
                code: 'SERVICE_OPERATION_FAILED',
                source: 'TestService.failAsynchronously',
            }),
        );
    });
});

describe('RuntimeErrorManager', () => {
    it('logs a failure once when it propagates through a caused error', () => {
        const logger: LoggerStrategy = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            verbose: vi.fn(),
            warn: vi.fn(),
        };
        Logger.useLogger(logger);

        const configService = {
            identifierOptions: { generator: { generate: vi.fn(() => 'correlation-id') } },
            timeOptions: { provider: { now: vi.fn(() => 123) } },
        } as unknown as ConfigService;
        const manager = new RuntimeErrorManager(configService, new SafeModeContext());
        const context: RuntimeErrorContext = {
            category: 'application',
            code: 'SERVICE_OPERATION_FAILED',
            source: 'ApplicationManager.install',
        };
        const cause = new Error('Storage write failed.');

        const originalRecord = manager.capture(cause, context);
        const wrappedRecord = manager.capture(
            new MarsaError('LIFECYCLE_HOOK_FAILED', 'Lifecycle failed.', { cause }),
            { ...context, source: 'LifecycleManager.perform' },
        );

        expect(wrappedRecord).toBe(originalRecord);
        expect(logger.error).toHaveBeenCalledOnce();
    });
});

describe('application service error reporting', () => {
    it('reports an install failure and preserves it for the caller', async () => {
        await resetConfig();
        const config = await getConfig();
        const logger: LoggerStrategy = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            verbose: vi.fn(),
            warn: vi.fn(),
        };
        config.loggerOptions.strategy = logger;
        Logger.useLogger(logger);

        const container = new IocContainer();
        container.loadModule(EntryModule);
        const applicationManager = container.resolve<ApplicationManager>(ApplicationManager);

        await expect(applicationManager.install({} as never)).rejects.toMatchObject({
            code: 'INVALID_APPLICATION',
        });
        expect(logger.error).toHaveBeenCalledOnce();
    });
});

describe('plugin error management access', () => {
    it('exposes the shared RuntimeErrorManager through PluginCommonModule', () => {
        const container = new IocContainer();
        container.loadModule(EntryModule);
        container.loadModule(RuntimeErrorPluginModule);

        const plugin = container.resolve<PluginErrorConsumer>(PluginErrorConsumer, RuntimeErrorPluginModule);
        const runtimeErrorManager = container.resolve<RuntimeErrorManager>(
            RuntimeErrorManager,
            RuntimeErrorPluginModule,
        );

        expect(plugin.runtimeErrorManager).toBe(runtimeErrorManager);
    });
});
