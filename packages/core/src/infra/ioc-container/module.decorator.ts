import type { ModuleMeta } from './types.js';

export const MODULE_DECORATOR_METADATA_KEY = Symbol('MODULE_DECORATOR_METADATA');

export function Module(meta: ModuleMeta) {
    return function (target: Function) {
        Reflect.defineMetadata(MODULE_DECORATOR_METADATA_KEY, meta, target);
    };
}
