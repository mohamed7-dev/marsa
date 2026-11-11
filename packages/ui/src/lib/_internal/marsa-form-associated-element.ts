import { isServer, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { MarsaInvalidEvent } from '../events/invalid.js';
import { createCustomErrorValidator } from './form-validators/custom-error-validator.js';
import { MarsaElement } from './marsa-element.js';

type ValidationFlag = Exclude<keyof ValidityState, 'valid'>;

/**
 * @description
 * Describes a validator used by Marsa form-associated controls.
 * @internal
 */
export interface MarsaFormValidator<Element extends MarsaFormAssociatedElement = MarsaFormAssociatedElement> {
    /**
     * @description
     * Names of host attributes that should trigger the validator.
     * @internal
     */
    observedAttributes?: string[];
    /**
     * @description
     * Evaluates the element and identifies invalidity flags when validation fails.
     * @internal
     */
    checkValidity: (element: Element) => {
        message: string;
        isValid: boolean;
        invalidKeys: ValidationFlag[];
    };
    /**
     * @description
     * Optional message source retained for validator implementations.
     * @internal
     */
    message?: string | ((element: Element) => string);
}

interface MarsaFormControlContract extends MarsaElement {
    pattern?: string;
    min?: number | string | Date;
    max?: number | string | Date;
    step?: number | 'any';
    required?: boolean;
    minlength?: number;
    maxlength?: number;
    name: null | string;
    disabled?: boolean;
    defaultValue?: unknown;
    defaultChecked?: boolean;
    checked?: boolean;
    defaultSelected?: boolean;
    selected?: boolean;
    get form(): HTMLFormElement | null;
    set form(value: string);
    value?: unknown;
    readonly validity: ValidityState;
    readonly validationMessage: string;
    checkValidity: () => boolean;
    reportValidity: () => boolean;
    setCustomValidity: (message: string) => void;
    isDirty: boolean;
    valueHasChanged?: boolean;
    customError: null | string;
}

/**
 * @description
 * Provides Marsa form controls with form ownership, validation, and value submission support.
 * @internal
 */
export class MarsaFormAssociatedElement
    extends MarsaElement
    implements Omit<ElementInternals, 'form' | 'setFormValue'>, MarsaFormControlContract
{
    static formAssociated = true;

    /**
     * @description
     * Events tracked to determine when the control has been interacted with.
     * @internal
     */
    public interactionEvents: string[] = ['input'];
    private seenInteractionEvents: string[] = [];

    /**
     * @description
     * Optional native control used for value access and validation-message anchoring.
     * @internal
     */
    public input?: (HTMLElement & { value: unknown }) | HTMLInputElement | HTMLTextAreaElement;

    /**
     * @description
     * Additional validators applied to this control instance.
     * @internal
     */
    public additionalValidators: MarsaFormValidator[] = [];

    /**
     * @description
     * Whether this control participates in required-value validation.
     * @internal
     */
    public required = false;

    /**
     * @description
     * The submitted form field name.
     * @internal
     */
    @property({ reflect: true })
    public name: string | null = null;

    /**
     * @description
     * Disables this control and excludes it from constraint validation.
     * @internal
     */
    @property({ type: Boolean })
    disabled = false;

    /**
     * @description
     * Custom validation message kept in sync with ElementInternals.
     * @internal
     */
    @property({ attribute: 'custom-error', reflect: true })
    customError: string | null = null;

    /**
     * @description
     * Tracks whether the user has interacted with this control.
     * @internal
     */
    @property({ state: true, attribute: false })
    isDirty = false;

    /**
     * @description
     * Tracks whether the control's current value differs from its initial value.
     * @internal
     */
    @property({ state: true, attribute: false })
    isValueChanged = false;

    /**
     * @description
     * Returns the browser-maintained validity state.
     * @internal
     */
    @property({ state: true, reflect: false, type: Object })
    get validity(): ValidityState {
        return this.elementInternals.validity;
    }

    /**
     * @description
     * Returns the custom states managed by this control's form internals.
     * @internal
     */
    get states(): CustomStateSet {
        return this.elementInternals.states;
    }

    /**
     * @description
     * Supplies class-level validators and their observed attributes.
     * @internal
     */
    static get validationRules(): MarsaFormValidator[] {
        return isServer ? [] : [createCustomErrorValidator()];
    }

    /**
     * @description
     * Adds validator attributes to the observed attributes inherited from Lit.
     * @internal
     */
    static get observedAttributes(): string[] {
        const observed = new Set(super.observedAttributes || []);

        for (const validator of this.validationRules) {
            for (const attribute of validator.observedAttributes ?? []) {
                observed.add(attribute);
            }
        }

        return [...observed];
    }

    /**
     * @description
     * Attaches the invalid-event handler used to mark failed controls as interacted with.
     * @internal
     */
    constructor() {
        super();
        this.addEventListener('invalid', this.onInvalid);
    }

    /**
     * @description
     * Registers interaction listeners and refreshes the control's validity when connected.
     * @internal Invoked by the custom-element lifecycle.
     */
    connectedCallback(): void {
        super.connectedCallback();
        this.refreshAfterRender(() => this.refreshValidity());

        for (const eventType of this.interactionEvents) {
            this.addEventListener(eventType, this.onInteract);
        }
    }

    /**
     * @description
     * Returns the element to which native validation messages should be anchored.
     * @internal Override in a derived component to select a different anchor.
     */
    get validationTarget(): HTMLElement | undefined {
        return this.input;
    }

    /**
     * @description
     * Applies a custom validation message through this element's form internals.
     * @internal Used by form-control implementations and validation helpers.
     */
    public setCustomValidity(message: string): void {
        if (message.length === 0) {
            this.customError = null;
            this.setValidity({});
            return;
        }

        this.customError = message;
        this.setValidity({ customError: true }, message, this.validationTarget);
    }

    /**
     * @description
     * Returns validators declared by the class and this control instance.
     * @internal Used during constraint validation.
     */
    private collectValidators(): MarsaFormValidator[] {
        const constructor = this.constructor as typeof MarsaFormAssociatedElement;
        return [...(constructor.validationRules ?? []), ...this.additionalValidators];
    }

    /**
     * @description
     * Recomputes this control's validity and returns whether it passes constraint validation.
     * @internal Implements the form-associated element validation contract.
     */
    public checkValidity(): boolean {
        this.refreshValidity();
        return this.elementInternals.checkValidity();
    }

    /**
     * @description
     * Recomputes validity, marks the control as interacted with, and reports any validation message.
     * @internal Implements the form-associated element validation contract.
     */
    public reportValidity(): boolean {
        this.refreshValidity();
        this.isDirty = true;
        return this.elementInternals.reportValidity();
    }

    /**
     * @description
     * Returns the browser-generated validation message.
     * @internal
     */
    get validationMessage(): string {
        return this.elementInternals.validationMessage;
    }

    /**
     * @description
     * Returns the labels associated with this form control.
     * @internal
     */
    get labels(): NodeList {
        return this.elementInternals.labels;
    }

    /**
     * @description
     * Returns the form that owns this control.
     * @internal
     */
    get form(): HTMLFormElement | null {
        return this.elementInternals.form;
    }

    /**
     * @description
     * Sets the id of a form to associate with this control.
     * @internal Used by form-control implementations.
     */
    set form(value: string) {
        if (value) {
            this.setAttribute('form', value);
        } else {
            this.removeAttribute('form');
        }
    }

    /**
     * @description
     * Indicates whether this control participates in constraint validation.
     * @internal
     */
    get willValidate(): boolean {
        return this.elementInternals.willValidate;
    }

    /**
     * @description
     * Applies validity flags and updates the custom validity-related CSS states.
     * @internal Mirrors ElementInternals.setValidity for form-control implementations.
     */
    public setValidity(...args: Parameters<ElementInternals['setValidity']>): void {
        const [flags, message, anchor] = args;
        this.elementInternals.setValidity(flags, message, anchor ?? this.validationTarget);
        this.requestUpdate('validity');
        this.syncCustomStates();
    }

    /**
     * @description
     * Stores the submitted value and optional restoration state in the browser's form internals.
     * @internal Used by form-control implementations.
     */
    public writeFormValue(...args: Parameters<ElementInternals['setFormValue']>): void {
        this.elementInternals.setFormValue(...args);
    }

    /**
     * @description
     * Synchronizes required, validity, and interaction states with the browser's custom state set.
     * @internal Used after validity or interaction state changes.
     */
    public syncCustomStates(): void {
        const valid = this.elementInternals.validity.valid;
        const interacted = this.isDirty;

        this.setCustomState('required', Boolean(this.required));
        this.setCustomState('optional', !this.required);
        this.setCustomState('invalid', !valid);
        this.setCustomState('valid', valid);
        this.setCustomState('user-invalid', !valid && interacted);
        this.setCustomState('user-valid', valid && interacted);
    }

    /**
     * @description
     * Clears custom validation errors and restores an unconstrained validity state.
     * @internal Used during reset and disabled-state transitions.
     */
    public clearValidity(): void {
        this.setCustomValidity('');
        this.setValidity({});
    }

    /**
     * @description
     * Runs the configured validators and applies their combined results to ElementInternals.
     * @internal Called from lifecycle updates and form validation operations.
     */
    public refreshValidity(): void {
        if (this.disabled || !this.willValidate || this.hasAttribute('disabled')) {
            this.clearValidity();
            return;
        }

        const validators = this.collectValidators();
        if (validators.length === 0) {
            return;
        }

        const flags: Partial<Record<ValidationFlag, boolean>> = {
            customError: Boolean(this.customError),
        };
        const failures = validators
            .map(validator => validator.checkValidity(this))
            .filter(result => !result.isValid);

        for (const { invalidKeys } of failures) {
            for (const key of invalidKeys) {
                flags[key] = true;
            }
        }

        const firstMessage = failures.find(result => result.message.length > 0)?.message;
        const message = firstMessage ?? this.validationMessage;
        this.setValidity(flags, message, this.validationTarget || this.input || undefined);
    }

    protected willUpdate(changedProperties: PropertyValues): void {
        if (!isServer && changedProperties.has('customError')) {
            if (!this.customError) {
                this.customError = null;
            }
            this.setCustomValidity(this.customError || '');
        }

        if (changedProperties.has('disabled')) {
            this.setCustomState('disabled', this.disabled);
            if (this.hasAttribute('disabled') || (!isServer && !this.matches(':disabled'))) {
                this.toggleAttribute('disabled', this.disabled);
            }
        }

        if (
            changedProperties.has('value') ||
            changedProperties.has('defaultValue') ||
            changedProperties.has('disabled')
        ) {
            // Some controls implement value as an accessor and others as a property.
            // @ts-expect-error The value property is intentionally supplied by derived controls.
            this.syncFormValue(this.value);
        }

        super.willUpdate(changedProperties);
        this.refreshAfterRender(() => this.refreshValidity());
    }

    protected firstUpdated(changedProperties: PropertyValues): void {
        super.firstUpdated(changedProperties);
        this.refreshValidity();
    }

    /**
     * @description
     * Clears transient validation and interaction state when the owning form resets.
     * @internal Invoked by the browser's form-associated custom-element lifecycle.
     */
    formResetCallback(): void {
        this.clearValidity();
        this.isDirty = false;
        this.isValueChanged = false;
        this.seenInteractionEvents = [];
        this.refreshValidity();
    }

    /**
     * @description
     * Updates the disabled state when the owning form's disabled state changes.
     * @internal Invoked by the browser's form-associated custom-element lifecycle.
     */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled;
        this.refreshValidity();
    }

    /**
     * @description
     * Restores the value previously stored with the form-associated value.
     * @internal Invoked by the browser during state restoration or autofill.
     */
    formStateRestoreCallback(
        state: string | File | FormData | null,
        reason: 'autocomplete' | 'restore',
    ): void {
        this.refreshAfterRender(() => {
            // @ts-expect-error Derived controls supply their own value property.
            this.value = state;

            if (reason === 'restore') {
                this.clearValidity();
            }

            this.refreshValidity();
        });
    }

    /**
     * @description
     * Converts a control value to the value submitted with its owning form.
     * @internal Override when a derived control needs custom form serialization.
     */
    protected syncFormValue(value: unknown): void {
        if (Array.isArray(value)) {
            if (!this.name) {
                return;
            }

            const formData = new FormData();
            for (const item of value) {
                formData.append(this.name, item as string);
            }
            this.writeFormValue(formData, formData);
            return;
        }

        type FormValue = Parameters<ElementInternals['setFormValue']>[0];
        this.writeFormValue(value as FormValue, value as FormValue);
    }

    private refreshAfterRender(callback: () => void): void {
        if (this.didSSR && !this.hasUpdated) {
            void this.updateComplete.then(callback);
            return;
        }

        callback();
    }

    private onInteract = (event: Event): void => {
        if (this.interactionEvents.includes(event.type)) {
            this.seenInteractionEvents.push(event.type);
        }

        if (this.seenInteractionEvents.length === this.interactionEvents.length) {
            this.isDirty = true;
        }
    };

    private onInvalid = (event: Event): void => {
        if (event.target !== this) {
            return;
        }

        this.isDirty = true;
        this.dispatchEvent(new MarsaInvalidEvent());
    };
}
