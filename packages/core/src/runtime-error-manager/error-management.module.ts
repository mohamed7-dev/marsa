import { ConfigModule } from '../config/config.module.js';
import { Module } from '../infra/ioc-container/module.decorator.js';
import { RuntimeErrorReporter } from './error-reporting.service.js';
import { RuntimeErrorManager } from './runtime-error-manager.service.js';

/**
 * @description
 * Provides the shared runtime error manager and its service reporter.
 * @docsPage core/errors
 * @docsCategory Services
 */
@Module({
    imports: [ConfigModule],
    providers: [RuntimeErrorManager, RuntimeErrorReporter],
    exports: [RuntimeErrorManager, RuntimeErrorReporter],
})
export class ErrorManagementModule {}
