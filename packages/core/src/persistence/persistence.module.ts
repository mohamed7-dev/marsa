import { ConfigModule } from '../config/config.module.js';
import { Module } from '../infra/ioc-container/module.decorator.js';
import { PersistenceService } from './persistence.service.js';

@Module({
    imports: [ConfigModule],
    providers: [PersistenceService],
    exports: [PersistenceService],
})
export class PersistenceModule {}
