import type { MarsaFormValidator } from '../marsa-form-associated-element.js';

/**
 * @description
 * Creates a validator that applies the control's manually assigned custom error.
 * @internal
 */
export const createCustomErrorValidator = (): MarsaFormValidator => {
    return {
        observedAttributes: ['custom-error'],
        checkValidity(element) {
            const validity: ReturnType<MarsaFormValidator['checkValidity']> = {
                message: '',
                isValid: true,
                invalidKeys: [],
            };

            if (element.customError) {
                validity.message = element.customError;
                validity.isValid = false;
                validity.invalidKeys = ['customError'];
            }

            return validity;
        },
    };
};
