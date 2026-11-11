import 'reflect-metadata';

import { getConfig, setConfig } from './config/config-utils.js';
import type { PartialMarsaConfigOptions, RuntimeMarsaConfigOptions } from './config/marsa-config.contract.js';
import { Logger } from './logger/logger.js';
import { MarsaApp } from './marsa-app.js';
import { getConfigurationFunction } from './plugins/plugin-metadata.js';

export async function bootstrap(userOptions?: PartialMarsaConfigOptions) {
    await preBootstrap(userOptions);

    const app = new MarsaApp((await import('./entry.module.js')).EntryModule);
    await app.initialize();

    return app;
}

async function preBootstrap(userOptions?: PartialMarsaConfigOptions): Promise<RuntimeMarsaConfigOptions> {
    await setConfig(userOptions);

    let config = await getConfig();
    Logger.useLogger(config.loggerOptions.strategy);

    config = await runPluginConfigurations(config);
    Logger.useLogger(config.loggerOptions.strategy);

    return config;
}

export async function runPluginConfigurations(
    config: RuntimeMarsaConfigOptions,
): Promise<RuntimeMarsaConfigOptions> {
    for (const plugin of config.plugins) {
        const configFn = getConfigurationFunction(plugin);
        if (typeof configFn === 'function') {
            const result = await configFn(config);
            Object.assign(config, result);
        }
    }
    return config;
}
