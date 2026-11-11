import { Module } from '../infra/ioc-container/module.decorator.js';
import { SafeModeContext } from './safe-mode-context.js';

@Module({
    providers: [SafeModeContext],
    exports: [SafeModeContext],
    global: true,
})
export class SafeModeModule {}
