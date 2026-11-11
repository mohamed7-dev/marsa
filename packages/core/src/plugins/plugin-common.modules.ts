import { ConfigModule } from '../config/config.module.js';
import { EventBusModule } from '../event-bus/even-bus.module.js';
import { Module } from '../infra/ioc-container/module.decorator.js';
import { ErrorManagementModule } from '../runtime-error-manager/error-management.module.js';
import { ServiceModule } from '../services/service.module.js';

/**
 * @description
 * This module provides common services, configuration, event bus, and error-management capabilities
 * required by a typical plugin. It should be imported into plugins to avoid having to
 * repeat the same boilerplate for each individual plugin.
 *
 * The PluginCommonModule exports:
 *
 * * `EventBusModule`, allowing the injection of the {@link EventBus} service.
 * * `ConfigModule`, allowing the injection of the {@link ConfigService}.
 * * `ServiceModule`, including the generic {@link StateService} collection service.
 * * `ErrorManagementModule`, including the shared {@link RuntimeErrorManager}.
 *
 * @docsCategory core/plugins
 */
@Module({
    imports: [EventBusModule, ConfigModule, ServiceModule, ErrorManagementModule],
    exports: [EventBusModule, ConfigModule, ServiceModule, ErrorManagementModule],
})
export class PluginCommonModule {}
