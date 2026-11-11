/**
 * @description
 * A simple utility that excludes undefined and nullish values from an input
 */
export function notNullOrUndefined<T>(input: T | undefined | null): input is T {
    return input !== undefined && input !== null;
}
