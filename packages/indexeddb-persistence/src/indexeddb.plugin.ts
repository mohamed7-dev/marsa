import 'reflect-metadata';

import { MarsaPlugin } from '@marsa/core';
import { IndexedDBPersistenceAdapter } from './adapter.js';

@MarsaPlugin({
    configuration: config => {
        config.persistenceOptions.adapter = new IndexedDBPersistenceAdapter();
        return config;
    },
})
export class IndexedDbPersistencePlugin {}
