import { Module } from '../infra/ioc-container/module.decorator.js';
import { ErrorManagementModule } from '../runtime-error-manager/error-management.module.js';
import { EventBus } from './event-bus.service.js';

@Module({
    imports: [ErrorManagementModule],
    providers: [EventBus],
    exports: [EventBus],
})
export class EventBusModule {}
