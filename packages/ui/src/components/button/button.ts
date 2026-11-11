import { css, html, type CSSResultGroup } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { MarsaFormAssociatedElement } from '../../lib/_internal/marsa-form-associated-element.js';
import { watch } from '../../lib/_internal/watch.js';
import { MarsaInvalidEvent } from '../../lib/events/invalid.js';
import buttonStyles from '../../styles/components/buttons.styles.js';

/**
 * @description Selects a visual style for a basic button.
 * @docsPage ui/button
 * @docsCategory UI
 */
export type ButtonVariant = 'regular' | 'flat' | 'suggested' | 'destructive' | 'opaque' | 'osd';

/**
 * @description Selects the shape of a basic button.
 * @docsPage ui/button
 * @docsCategory UI
 */
export type ButtonAppearance = 'regular' | 'pill' | 'circular';

const variantClasses = new Map<ButtonVariant, string>([
    ['flat', 'adw-flat'],
    ['suggested', 'adw-suggested-action'],
    ['destructive', 'adw-destructive-action'],
    ['opaque', 'adw-opaque'],
    ['osd', 'adw-osd'],
]);

const appearanceClasses = new Map<ButtonAppearance, string>([
    ['pill', 'adw-pill'],
    ['circular', 'adw-circular'],
]);

const resetStyles = css`
    :host {
        display: inline-flex;
        vertical-align: middle;
    }

    button {
        appearance: none;
        -webkit-appearance: none;
        box-sizing: content-box;
        margin: 0;
        border: 0;
        background: none;
        font: inherit;
        color: inherit;
        text-align: inherit;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        flex: none;
        cursor: default;
        -webkit-user-select: none;
        user-select: none;
    }

    button:disabled {
        pointer-events: none;
    }

    .adw-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
`;

/**
 * @description
 * A styled basic button that preserves native behavior.
 * @docsPage ui/button
 * @docsCategory UI
 */
@customElement('marsa-button')
export class MarsaButton extends MarsaFormAssociatedElement {
    static styleGroup: CSSResultGroup = [buttonStyles, resetStyles];

    public interactionEvents: string[] = ['click'];

    @query('.adw-button')
    button: HTMLButtonElement;

    @state()
    declare private keyboardActivating: boolean;

    /**
     * @description
     * Selects the visual treatment.
     * The default regular variant uses the standard raised button style.
     * @default 'regular'
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ reflect: true })
    variant: ButtonVariant = 'regular';

    /**
     * @description
     * Selects the shape.
     * The default regular appearance uses the standard rounded rectangle.
     * @default 'regular'
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ reflect: true })
    appearance: ButtonAppearance = 'regular';

    /**
     * @description
     * Disables focus and activation using the native button behavior.
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ type: Boolean, reflect: true })
    disabled: boolean = false;

    /**
     * @description
     * Requests native autofocus when the button is connected.
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ type: Boolean, reflect: true })
    autofocus: boolean = false;

    /**
     * @description
     * The type of button. Note that the default value is `button` instead of `submit`, which is opposite of how native
     * `<button>` elements behave. When the type is `submit`, the button will submit the surrounding form.
     * @default 'button'
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ reflect: true })
    type: 'button' | 'submit' | 'reset' = 'button';

    /**
     * @description
     * The name of the button, submitted as a name/value pair with form data, but only when this button is the submitter.
     * This attribute is ignored when `href` is present.
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ reflect: true })
    declare name: string;

    /**
     * @description
     * The value of the button, submitted as a pair with the button's name as part of the form data, but only when this
     * button is the submitter. This attribute is ignored when `href` is present.
     * @docsPage ui/button
     * @docsCategory UI
     */
    @property({ reflect: true })
    value: string;

    /**
     * @description
     * Sets the toggle state. When defined, the native button exposes `aria-pressed`;
     * a true value also applies the selected libadwaita style.
     * @docsPage ui/button
     * @docsCategory UI
     */
    public click(): void {
        this.button.click();
    }

    /**
     * @description
     * Focuses the inner native button.
     * @param options Focus options passed to the native button.
     * @docsPage ui/button
     * @docsCategory UI
     */
    public focus(options?: FocusOptions): void {
        this.button.focus(options);
    }

    /**
     * @description
     * Removes the focus from the inner native button.
     * @docsPage ui/button
     * @docsCategory UI
     */
    public blur(): void {
        this.button.blur();
    }

    private handleKeyDown(event: KeyboardEvent): void {
        if (!this.disabled && !event.repeat && (event.key === ' ' || event.key === 'Enter')) {
            this.keyboardActivating = true;
        }
    }

    private handleClick(event: PointerEvent): void {
        if (this.disabled) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        if (this.type !== 'button') return;

        if (!this.form) return;
    }

    private handleInvalid(): void {
        this.dispatchEvent(new MarsaInvalidEvent());
    }

    @watch('disabled', { waitUntilFirstUpdate: true })
    handleDisableChange() {
        this.setCustomState('disabled', this.disabled);
        this.refreshValidity();
    }

    protected render(): unknown {
        const variantClass = variantClasses.get(this.variant);
        const appearanceClass = appearanceClasses.get(this.appearance);

        return html`
            <button
                part="base"
                class=${classMap({
                    'adw-button': true,
                    ...(variantClass ? { [variantClass]: true } : {}),
                    ...(appearanceClass ? { [appearanceClass]: true } : {}),
                    'adw-keyboard-activating': this.keyboardActivating,
                })}
                type=${this.type}
                name=${this.name}
                value=${this.value}
                ?disabled=${this.disabled}
                aria-disabled=${this.disabled}
                ?autofocus=${this.autofocus}
                tabindex=${this.disabled ? '-1' : '0'}
                @click=${this.handleClick}
                @invalid=${this.handleInvalid}
                @keydown=${this.handleKeyDown}
                @keyup=${() => (this.keyboardActivating = false)}
                @blur=${() => (this.keyboardActivating = false)}
                @pointerdown=${() => (this.keyboardActivating = false)}
            >
                <span class="adw-box"><slot></slot></span>
            </button>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'marsa-button': MarsaButton;
    }
}
