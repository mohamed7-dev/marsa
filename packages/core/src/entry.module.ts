import { ConfigModule } from './config/config.module.js';
import { EventBusModule } from './event-bus/even-bus.module.js';
import { Module } from './infra/ioc-container/module.decorator.js';
import { PersistenceModule } from './persistence/persistence.module.js';
import { SafeModeModule } from './safe-mode/safe-mode.module.js';
import { ServiceModule } from './services/service.module.js';

@Module({
    imports: [ConfigModule, ServiceModule, EventBusModule, PersistenceModule, SafeModeModule],
})
export class EntryModule {}
