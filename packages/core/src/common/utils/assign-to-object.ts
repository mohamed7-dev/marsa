export const OBJECT_PROTOTYPE_KEYS = ['__proto__', 'prototype', 'constructor'];

export function assignToObject(target: object, key: string, value: unknown): void {
    if (OBJECT_PROTOTYPE_KEYS.includes(key)) {
        return;
    }

    Object.defineProperty(target, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
