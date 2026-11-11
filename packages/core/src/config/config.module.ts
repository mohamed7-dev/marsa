import { Module } from '../infra/ioc-container/module.decorator.js';
import { ConfigService } from './config.service.js';

@Module({
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
