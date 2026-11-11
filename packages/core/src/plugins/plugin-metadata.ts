import type { ClassType } from '../common/types/utils.js';
import type { PluginConfigurationFn } from './marsa-plugin.js';

export const PLUGIN_METADATA = {
    CONFIGURATION: 'configuration',
};

export function getConfigurationFunction(plugin: ClassType<any>): PluginConfigurationFn | undefined {
    return reflectMetadata(plugin, PLUGIN_METADATA.CONFIGURATION);
}

function reflectMetadata(metatype: ClassType<any>, metadataKey: string) {
    return Reflect.getMetadata(metadataKey, metatype);
}
