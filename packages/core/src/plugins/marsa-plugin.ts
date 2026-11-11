import { pick } from '../common/utils/pick.js';
import type { RuntimeMarsaConfigOptions } from '../config/marsa-config.contract.js';
import { MODULE_METADATA } from '../infra/ioc-container/constants.js';
import { Module } from '../infra/ioc-container/module.decorator.js';
import type { ModuleMeta } from '../infra/ioc-container/types.js';
import { PLUGIN_METADATA } from './plugin-metadata.js';

/**
 * @description
 * This method is called before the app bootstraps and should be used to perform any needed modifications to the {@link MarsaConfig}.
 *
 * @docsCategory core/plugins
 * @docsPage MarsaPluginMetadata
 */
export type PluginConfigurationFn = (
    config: RuntimeMarsaConfigOptions,
) => RuntimeMarsaConfigOptions | Promise<RuntimeMarsaConfigOptions>;

/**
 * @description
 * Defines the metadata of a Marsa plugin. This interface is an superset of the {@link ModuleMeta}
 * (which allows the definition of `imports`, `exports`, and `providers`)
 * In addition, the MarsaPluginMetadata allows the definition of
 * extra properties specific to Marsa.
 *
 * @docsCategory core/plugins
 * @docsPage MarsaPluginMetadata
 */
interface MarsaPluginMetadata extends ModuleMeta {
    /**
     * @description
     * A function which can modify the {@link MarsaConfig} object before the core application bootstraps.
     */
    configuration?: PluginConfigurationFn;
}

export function MarsaPlugin(pluginMetadata: MarsaPluginMetadata): ClassDecorator {
    return (target: Function) => {
        for (const metadataProperty of Object.values(PLUGIN_METADATA)) {
            const property = metadataProperty as keyof MarsaPluginMetadata;
            if (pluginMetadata[property] != null) {
                Reflect.defineMetadata(property, pluginMetadata[property], target);
            }
        }

        const moduleMetadata = pick(pluginMetadata, Object.values(MODULE_METADATA) as any);
        const exportedProviders = moduleMetadata.providers || [];
        moduleMetadata.exports = [...(moduleMetadata.exports || []), ...exportedProviders];
        Module(moduleMetadata)(target);
    };
}
