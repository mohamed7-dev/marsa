import { isClassInstance } from './data-type-validators.js';

export function simpleDeepClone<T extends string | number | any[] | object>(input: T): T {
    // if not array or object or is null return self
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    let output: any;
    let i: number | string;
    // handle case: array
    if (Array.isArray(input)) {
        let l: any;
        output = [] as any[];
        for (i = 0, l = input.length; i < l; i++) {
            output[i] = simpleDeepClone(input[i]);
        }
        return output;
    }
    if (isClassInstance(input)) {
        return input;
    }
    // handle case: object
    output = {};
    for (i in input) {
        if (Object.hasOwn(input, i)) {
            output[i] = simpleDeepClone((input as any)[i]);
        }
    }
    return output;
}
