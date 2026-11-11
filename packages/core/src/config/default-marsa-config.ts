import { DefaultIdentifierGeneratorStrategy } from './identifiers/default-identifier-generator.strategy.js';
import { StdoutLoggerStrategy } from './logger/stdout-logger.strategy.js';
import type { RuntimeMarsaConfigOptions } from './marsa-config.contract.js';
import { MemoryPersistenceAdapterStrategy } from './persistence/memory-persistence-adapter.strategy.js';
import { DefaultTimeProviderStrategy } from './time/default-time-provider.strategy.js';

export const defaultMarsaConfig: RuntimeMarsaConfigOptions = {
    persistenceOptions: {
        adapter: new MemoryPersistenceAdapterStrategy(),
    },
    stateOptions: {
        persistenceEnabled: true,
        schemaVersion: 1,
        debounceMs: 300,
        migrations: [],
    },
    timeOptions: {
        provider: new DefaultTimeProviderStrategy(),
    },
    identifierOptions: {
        generator: new DefaultIdentifierGeneratorStrategy(),
    },
    loggerOptions: {
        strategy: new StdoutLoggerStrategy(),
    },
    plugins: [],
};
