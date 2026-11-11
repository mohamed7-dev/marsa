import type { Token } from './types.js';

export const INJECT_DECORATOR_METADATA_KEY = Symbol('INJECT_DECORATOR_METADATA');

export function Inject(token: Token) {
    return function (target: Function, _key: any, index: number) {
        const existing = Reflect.getMetadata(INJECT_DECORATOR_METADATA_KEY, target) || {};
        existing[index] = token;
        Reflect.defineMetadata(INJECT_DECORATOR_METADATA_KEY, existing, target);
    };
}
