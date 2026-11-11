export { bootstrap } from './bootstrap.js';
export type { StateOptions } from './config/marsa-config.contract.js';
export type {
    PersistenceAdapterStrategy,
    PersistenceStore,
} from './config/persistence/persistence-adapter.contract.js';
export * from './plugins/index.js';
export { PluginCommonModule } from './plugins/plugin-common.modules.js';
export { ErrorManagementModule } from './runtime-error-manager/error-management.module.js';
export { RuntimeErrorManager } from './runtime-error-manager/runtime-error-manager.service.js';
export type { RuntimeErrorContext } from './runtime-error-manager/runtime-error-manager.service.js';
export type {
    RuntimeError,
    RuntimeErrorCategory,
    RuntimeErrorRecord,
    RuntimeErrorSeverity,
} from './runtime-error-manager/types.js';
export { PersistedRecordSchema, PersistenceStoreNameSchema } from './schemas/persistence.js';
export type {
    ApplicationStateWriteOptions,
    PersistedRecord,
    PersistedRecordEntry,
    StateMigration,
    StatePersistenceFailure,
    StateServiceOptions,
    StateWriteOptions,
} from './schemas/persistence.js';
export type { StateCollection, StateCollectionOptions } from './services/state.contract.js';
export { StateService } from './services/state.service.js';
