import type { PartialMarsaConfigOptions, RuntimeMarsaConfigOptions } from './marsa-config.contract.js';
import { mergeConfig } from './merge-config.js';

let activeConfig: RuntimeMarsaConfigOptions;

async function loadDefaultConfig(): Promise<void> {
    activeConfig = (await import('./default-marsa-config.js')).defaultMarsaConfig;
}

export async function setConfig(userConfig?: PartialMarsaConfigOptions): Promise<void> {
    if (!activeConfig) {
        await loadDefaultConfig();
    }
    if (userConfig) {
        activeConfig = mergeConfig(userConfig, activeConfig);
    }
}

export async function getConfig(): Promise<RuntimeMarsaConfigOptions> {
    if (!activeConfig) {
        try {
            await loadDefaultConfig();
        } catch {
            console.error(
                "[MarsaConfig]: config can't be loaded, make sure to call `cacheConfig()` before running this method.",
            );
        }
    }
    return activeConfig;
}

export function getConfigSync(): RuntimeMarsaConfigOptions {
    if (!activeConfig) {
        throw new Error(
            'Marsa configuration has not been initialized. Call bootstrap before resolving runtime services.',
        );
    }
    return activeConfig;
}

export async function cacheConfig(): Promise<RuntimeMarsaConfigOptions> {
    await loadDefaultConfig();
    return activeConfig;
}

export async function resetConfig(): Promise<void> {
    await loadDefaultConfig();
}
