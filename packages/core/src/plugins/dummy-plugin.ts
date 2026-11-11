import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import { ApplicationManager } from '../services/application.service.js';
import { MarsaPlugin } from './marsa-plugin.js';
import { PluginCommonModule } from './plugin-common.modules.js';

export const DUMMY_PLUGIN_INIT_OPTIONS = Symbol('DUMMY_PLUGIN_INIT_OPTIONS');

@Injectable()
class DummyService {
    constructor(private readonly applicationManager: ApplicationManager) {}

    dummyMethod() {
        this.applicationManager.install({} as any);
    }
}

@MarsaPlugin({
    imports: [PluginCommonModule],
    providers: [
        DummyService,
        { provide: DUMMY_PLUGIN_INIT_OPTIONS, useFactory: () => DummyPlugin.DummyPluginOptions },
    ],
})
export class DummyPlugin {
    static DummyPluginOptions = {};
}
