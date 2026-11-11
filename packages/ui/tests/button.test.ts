// @vitest-environment jsdom
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { MarsaButton } from '../src/components/button/button.js';
import { MarsaElement } from '../src/lib/_internal/marsa-element.js';
import buttonStyles from '../src/styles/components/buttons.styles.js';
import hostStyles from '../src/styles/host.styles.js';

const attachInternalsDescriptor = Object.getOwnPropertyDescriptor(MarsaElement.prototype, 'attachInternals');
Object.defineProperty(MarsaElement.prototype, 'attachInternals', {
    configurable: true,
    value() {
        return {
            form: null,
            labels: document.querySelectorAll('label'),
            validity: { valid: true },
            validationMessage: '',
            willValidate: true,
            states: {
                add() {},
                delete() {},
                has() {
                    return false;
                },
            },
            setValidity() {},
            setFormValue() {},
            checkValidity() {
                return true;
            },
            reportValidity() {
                return true;
            },
        };
    },
});

describe('MarsaButton', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    afterAll(() => {
        if (attachInternalsDescriptor) {
            Object.defineProperty(MarsaElement.prototype, 'attachInternals', attachInternalsDescriptor);
        } else {
            Reflect.deleteProperty(MarsaElement.prototype, 'attachInternals');
        }
    });

    function createButton(): MarsaButton {
        const button = document.createElement('marsa-button') as MarsaButton;
        document.body.append(button);
        return button;
    }

    function buttonClassNames(button: MarsaButton): string {
        return button.shadowRoot?.querySelector('button')?.className.trim().replace(/\s+/g, ' ') ?? '';
    }

    it('combines the shared host styles with the button styles', () => {
        expect(MarsaButton.styles).toEqual([hostStyles, buttonStyles, expect.anything()]);
        const styles = MarsaButton.styles;
        const resetStyles = Array.isArray(styles) ? styles[2] : undefined;
        expect(resetStyles?.cssText).toContain('button:disabled');
        expect(resetStyles?.cssText).toContain('pointer-events: none');
    });

    it('renders a native button with default styling and slotted content', async () => {
        const button = document.createElement('marsa-button') as MarsaButton;
        button.textContent = 'Save';
        document.body.append(button);
        await button.updateComplete;

        const nativeButton = button.shadowRoot?.querySelector('button');
        const slot = button.shadowRoot?.querySelector('slot');
        expect(button.variant).toBe('regular');
        expect(button.appearance).toBe('regular');
        expect(nativeButton?.type).toBe('button');
        expect(buttonClassNames(button)).toBe('adw-button');
        expect(slot?.parentElement?.classList.contains('adw-box')).toBe(true);
        expect(slot?.assignedNodes()[0]).toBe(button.firstChild);
    });

    it.each([
        ['regular', 'adw-button'],
        ['flat', 'adw-button adw-flat'],
        ['suggested', 'adw-button adw-suggested-action'],
        ['destructive', 'adw-button adw-destructive-action'],
        ['opaque', 'adw-button adw-opaque'],
        ['osd', 'adw-button adw-osd'],
    ] as const)('applies the %s visual variant', async (variant, classNames) => {
        const button = createButton();
        button.variant = variant;
        await button.updateComplete;

        expect(buttonClassNames(button)).toBe(classNames);
    });

    it.each([
        ['regular', 'adw-button'],
        ['pill', 'adw-button adw-pill'],
        ['circular', 'adw-button adw-circular'],
    ] as const)('applies the %s shape', async (appearance, classNames) => {
        const button = createButton();
        button.appearance = appearance;
        await button.updateComplete;

        expect(buttonClassNames(button)).toBe(classNames);
    });

    it('ignores unknown style values from markup', async () => {
        const button = document.createElement('marsa-button');
        button.setAttribute('variant', 'constructor');
        button.setAttribute('appearance', 'toString');
        document.body.append(button);
        await (button as MarsaButton).updateComplete;

        expect(buttonClassNames(button as MarsaButton)).toBe('adw-button');
    });

    it('uses native disabled and autofocus behavior', async () => {
        const button = createButton();
        button.disabled = true;
        button.autofocus = true;
        await button.updateComplete;

        const nativeButton = button.shadowRoot?.querySelector('button');
        expect(nativeButton?.disabled).toBe(true);
        expect(nativeButton?.autofocus).toBe(true);
        expect(button.hasAttribute('disabled')).toBe(true);
        expect(button.hasAttribute('autofocus')).toBe(true);

        button.disabled = false;
        await button.updateComplete;
        expect(nativeButton?.disabled).toBe(false);
    });

    it('keeps disabled buttons from reacting to pointer input or emitting click events', async () => {
        const button = createButton();
        await button.updateComplete;

        const nativeButton = button.shadowRoot?.querySelector('button');
        const clickListener = vi.fn();
        button.addEventListener('click', clickListener);

        button.disabled = true;
        await button.updateComplete;

        expect(nativeButton?.matches(':disabled')).toBe(true);
        nativeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clickListener).not.toHaveBeenCalled();
    });

    it('keeps behavior-specific state out of the primitive button API', () => {
        const button = createButton();

        expect(button).not.toHaveProperty('pressed');
        expect(button).not.toHaveProperty('hasPopup');
        expect(button).not.toHaveProperty('expanded');
        expect(button).not.toHaveProperty('dropActive');
        expect(button).not.toHaveProperty('controls');
    });

    it('provides native activation and suppresses activation while disabled', async () => {
        const button = createButton();
        await button.updateComplete;

        const clickListener = vi.fn();
        button.addEventListener('click', clickListener);
        button.shadowRoot?.querySelector('button')?.click();
        expect(clickListener).toHaveBeenCalledOnce();

        button.disabled = true;
        await button.updateComplete;
        button.shadowRoot?.querySelector('button')?.click();
        expect(clickListener).toHaveBeenCalledOnce();
    });

    it('forwards click, focus, and blur to the native button', async () => {
        const button = createButton();
        await button.updateComplete;
        const nativeButton = button.shadowRoot?.querySelector('button');
        const clickListener = vi.fn();
        button.addEventListener('click', clickListener);

        button.click();
        expect(clickListener).toHaveBeenCalledOnce();

        const focus = vi.spyOn(nativeButton!, 'focus');
        const blur = vi.spyOn(nativeButton!, 'blur');
        button.focus({ preventScroll: true });
        button.blur();
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(blur).toHaveBeenCalledOnce();
    });

    it('shows and clears the keyboard activation style without reimplementing activation', async () => {
        const button = createButton();
        await button.updateComplete;
        const nativeButton = button.shadowRoot?.querySelector('button');

        nativeButton?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        await button.updateComplete;
        expect(nativeButton?.classList.contains('adw-keyboard-activating')).toBe(true);

        nativeButton?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        await button.updateComplete;
        expect(nativeButton?.classList.contains('adw-keyboard-activating')).toBe(false);
    });
});
