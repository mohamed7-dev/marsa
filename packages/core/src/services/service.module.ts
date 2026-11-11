import { ConfigModule } from '../config/config.module.js';
import { EventBusModule } from '../event-bus/even-bus.module.js';
import { Module } from '../infra/ioc-container/module.decorator.js';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { ErrorManagementModule } from '../runtime-error-manager/error-management.module.js';
import { ApplicationInstanceManager } from './application-instance-manager.service.js';
import { ApplicationManager } from './application.service.js';
import { LifecycleManager } from './helpers/lifecycle-manager.service.js';
import { PermissionManager } from './helpers/permission-manager.service.js';
import { Validator } from './helpers/validator.service.js';
import { StateService } from './state.service.js';

const domain = [ApplicationManager, ApplicationInstanceManager, StateService];

const helpers = [Validator, LifecycleManager, PermissionManager];

@Module({
    imports: [PersistenceModule, EventBusModule, ConfigModule, ErrorManagementModule],
    providers: [...domain, ...helpers],
    exports: [...domain, ...helpers],
})
export class ServiceModule {}
