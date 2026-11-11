import { Injectable } from '../infra/ioc-container/injectable.decorator.js';
import { getConfigSync } from './config-utils.js';
import type { RuntimeMarsaConfigOptions } from './marsa-config.contract.js';

@Injectable()
export class ConfigService {
    private activeConfig: RuntimeMarsaConfigOptions;

    constructor() {
        this.activeConfig = getConfigSync();
    }

    get persistenceOptions(): RuntimeMarsaConfigOptions['persistenceOptions'] {
        return this.activeConfig.persistenceOptions;
    }

    get stateOptions(): RuntimeMarsaConfigOptions['stateOptions'] {
        return this.activeConfig.stateOptions;
    }

    get identifierOptions(): RuntimeMarsaConfigOptions['identifierOptions'] {
        return this.activeConfig.identifierOptions;
    }

    get timeOptions(): RuntimeMarsaConfigOptions['timeOptions'] {
        return this.activeConfig.timeOptions;
    }

    get lifecycleOptions(): RuntimeMarsaConfigOptions['lifecycleOptions'] {
        return this.activeConfig.lifecycleOptions;
    }

    get permissionOptions(): RuntimeMarsaConfigOptions['permissionOptions'] {
        return this.activeConfig.permissionOptions;
    }
}
