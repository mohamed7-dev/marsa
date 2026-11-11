import { assignToObject, OBJECT_PROTOTYPE_KEYS } from '../common/utils/assign-to-object.js';
import { isClassInstance, isObject } from '../common/utils/data-type-validators.js';
import { simpleDeepClone } from '../common/utils/simple-deep-clone.js';
import type {
    MarsaConfig,
    PartialMarsaConfigOptions,
    RuntimeMarsaConfigOptions,
} from './marsa-config.contract.js';

export function mergeConfig<Target extends MarsaConfig>(
    src: PartialMarsaConfigOptions,
    dest: Target,
    depth: number = 0,
): Target {
    if (!src) return dest;

    if (depth === 0) {
        // clone dest to keep original dest object un-mutated
        dest = simpleDeepClone(dest);
    }

    if (isObject(src) && isObject(dest)) {
        for (const key in src) {
            if (OBJECT_PROTOTYPE_KEYS.includes(key)) {
                continue;
            }
            const srcTypedKey = key as keyof typeof src;
            const srcValue = src[srcTypedKey];
            if (isObject(srcValue)) {
                // object has three possibilities:
                // 1. class constructor
                // 2. plain object
                // 3. value exists in src, but not in dest
                const destValue = dest[srcTypedKey];
                if (!destValue) {
                    // value doesn't exist in dest -> init
                    assignToObject(dest, srcTypedKey, {});
                }
                if (isClassInstance(srcValue)) {
                    // constructor -> assign directly to dest
                    assignToObject(dest, srcTypedKey, srcValue);
                } else {
                    // plain object -> run recursively
                    mergeConfig(
                        srcValue as unknown as PartialMarsaConfigOptions,
                        dest[srcTypedKey] as unknown as RuntimeMarsaConfigOptions,
                        depth + 1,
                    );
                }
            } else {
                // primitive -> assign directly to dest
                assignToObject(dest, srcTypedKey, srcValue);
            }
        }
    }

    return dest;
}
