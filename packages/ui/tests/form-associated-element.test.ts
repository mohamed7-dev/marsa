// @vitest-environment jsdom
import { afterAll, describe, expect, it, vi } from 'vitest';
import { MarsaElement } from '../src/lib/_internal/marsa-element.js';
import { MarsaFormAssociatedElement } from '../src/lib/_internal/marsa-form-associated-element.js';

const validationFlags = [
    'badInput',
    'customError',
    'patternMismatch',
    'rangeOverflow',
    'rangeUnderflow',
    'stepMismatch',
    'tooLong',
    'tooShort',
    'typeMismatch',
    'valueMissing',
] as const;

function createInternalsMock() {
    const stateNames = new Set<string>();
    const validity = Object.fromEntries([
        ...validationFlags.map(flag => [flag, false]),
        ['valid', true],
    ]) as Record<string, boolean>;
    let validationMessage = '';
    const states = {
        add: (name: string) => stateNames.add(name),
        delete: (name: string) => stateNames.delete(name),
        has: (name: string) => stateNames.has(name),
    } as unknown as CustomStateSet;

    const setValidity = vi.fn((flags: Parameters<ElementInternals['setValidity']>[0], message?: string) => {
        for (const flag of validationFlags) {
            validity[flag] = Boolean(flags?.[flag]);
        }
        validity.valid = validationFlags.every(flag => !validity[flag]);
        validationMessage = validity.valid ? '' : (message ?? '');
    });

    const setFormValue = vi.fn();
    const checkValidity = vi.fn(() => validity.valid);
    const reportValidity = vi.fn(() => validity.valid);
    const internals = {
        get form() {
            return null;
        },
        get labels() {
            return document.querySelectorAll('label');
        },
        get validity() {
            return validity as unknown as ValidityState;
        },
        get validationMessage() {
            return validationMessage;
        },
        willValidate: true,
        states,
        setValidity,
        setFormValue,
        checkValidity,
        reportValidity,
    } as unknown as ElementInternals;

    return { internals, setValidity, setFormValue, stateNames };
}

const mocks = new WeakMap<Element, ReturnType<typeof createInternalsMock>>();
const priorAttachInternals = Object.getOwnPropertyDescriptor(MarsaElement.prototype, 'attachInternals');
const priorRequestUpdate = Object.getOwnPropertyDescriptor(
    MarsaFormAssociatedElement.prototype,
    'requestUpdate',
);

Object.defineProperty(MarsaElement.prototype, 'attachInternals', {
    configurable: true,
    value(this: Element) {
        const mock = createInternalsMock();
        mocks.set(this, mock);
        return mock.internals;
    },
});

Object.defineProperty(MarsaFormAssociatedElement.prototype, 'requestUpdate', {
    configurable: true,
    value() {},
});

class TestFormControl extends MarsaFormAssociatedElement {}

customElements.define('marsa-form-associated-test', TestFormControl);

afterAll(() => {
    if (priorAttachInternals) {
        Object.defineProperty(MarsaElement.prototype, 'attachInternals', priorAttachInternals);
    } else {
        Reflect.deleteProperty(MarsaElement.prototype, 'attachInternals');
    }

    if (priorRequestUpdate) {
        Object.defineProperty(MarsaFormAssociatedElement.prototype, 'requestUpdate', priorRequestUpdate);
    } else {
        Reflect.deleteProperty(MarsaFormAssociatedElement.prototype, 'requestUpdate');
    }
});

function createControl(): { control: TestFormControl; mock: ReturnType<typeof createInternalsMock> } {
    const control = document.createElement('marsa-form-associated-test') as TestFormControl;
    const mock = mocks.get(control);
    if (!mock) {
        throw new Error('ElementInternals mock was not attached to the form control.');
    }
    return { control, mock };
}

describe('MarsaFormAssociatedElement', () => {
    it('combines validator flags and reports the first available validation message', () => {
        const { control, mock } = createControl();
        control.additionalValidators = [
            {
                checkValidity: () => ({
                    isValid: false,
                    message: '',
                    invalidKeys: ['valueMissing'],
                }),
            },
            {
                checkValidity: () => ({
                    isValid: false,
                    message: 'A value is required.',
                    invalidKeys: ['patternMismatch'],
                }),
            },
        ];

        control.refreshValidity();

        expect(mock.setValidity).toHaveBeenLastCalledWith(
            {
                customError: false,
                valueMissing: true,
                patternMismatch: true,
            },
            'A value is required.',
            undefined,
        );
        expect(control.checkValidity()).toBe(false);
        expect(mock.stateNames.has('invalid')).toBe(true);
    });

    it('forwards custom validity, form values, and external form association', () => {
        const { control, mock } = createControl();

        control.setCustomValidity('Choose a valid value.');
        expect(control.customError).toBe('Choose a valid value.');
        expect(control.validity.customError).toBe(true);

        control.setCustomValidity('');
        expect(control.customError).toBeNull();
        expect(control.validity.valid).toBe(true);

        control.writeFormValue('submitted-value', 'restoration-state');
        expect(mock.setFormValue).toHaveBeenLastCalledWith('submitted-value', 'restoration-state');

        control.form = 'external-form';
        expect(control.getAttribute('form')).toBe('external-form');
        control.form = '';
        expect(control.hasAttribute('form')).toBe(false);
        expect(control.form).toBeNull();

        control.additionalValidators = [];
        control.didSSR = false;
        control.formStateRestoreCallback('restored-value', 'restore');
        expect((control as TestFormControl & { value?: unknown }).value).toBe('restored-value');
        expect(control.validity.valid).toBe(true);

        control.formDisabledCallback(true);
        expect(control.disabled).toBe(true);
    });

    it('tracks interaction, dispatches Marsa invalid events, and resets transient state', () => {
        const { control } = createControl();
        control.interactionEvents = ['input', 'change'];
        const invalidListener = vi.fn();
        control.addEventListener('marsa-invalid', invalidListener);

        control.connectedCallback();
        control.dispatchEvent(new Event('input'));
        expect(control.isDirty).toBe(false);
        control.dispatchEvent(new Event('change'));
        expect(control.isDirty).toBe(true);

        control.dispatchEvent(new Event('invalid'));
        expect(invalidListener).toHaveBeenCalledOnce();
        expect(control.isDirty).toBe(true);
        expect(control.reportValidity()).toBe(true);

        control.isValueChanged = true;
        control.formResetCallback();
        expect(control.isDirty).toBe(false);
        expect(control.isValueChanged).toBe(false);
    });
});
