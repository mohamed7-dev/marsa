// @vitest-environment jsdom
import { css } from 'lit';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { MarsaElement } from '../src/lib/_internal/marsa-element.js';
import hostStyles from '../src/styles/host.styles.js';

const customStateNames = new Set<string>();
const customStates = {
    add(name: string) {
        customStateNames.add(name);
    },
    delete(name: string) {
        customStateNames.delete(name);
    },
    has(name: string) {
        return customStateNames.has(name);
    },
} as unknown as CustomStateSet;

const attachInternalsDescriptor = Object.getOwnPropertyDescriptor(MarsaElement.prototype, 'attachInternals');
Object.defineProperty(MarsaElement.prototype, 'attachInternals', {
    configurable: true,
    value() {
        return { states: customStates };
    },
});

const componentStyles = css`
    :host {
        display: block;
    }
`;

class TestMarsaElement extends MarsaElement {
    static styleGroup = componentStyles;
}

customElements.define('marsa-element-test', TestMarsaElement);

afterAll(() => {
    if (attachInternalsDescriptor) {
        Object.defineProperty(MarsaElement.prototype, 'attachInternals', attachInternalsDescriptor);
    } else {
        Reflect.deleteProperty(MarsaElement.prototype, 'attachInternals');
    }
});

describe('MarsaElement', () => {
    it('combines the shared host styles with component styles', () => {
        expect(TestMarsaElement.styles).toEqual([hostStyles, componentStyles]);
    });

    it('initializes reflected hydration state without shadowing Lit reactive accessors', async () => {
        const element = document.createElement('marsa-element-test') as TestMarsaElement;
        expect(element.didSSR).toBe(true);

        document.body.append(element);
        await expect(element.updateComplete).resolves.toBe(true);
        expect(element.hasAttribute('did-ssr')).toBe(true);

        element.didSSR = false;
        await element.updateComplete;
        expect(element.hasAttribute('did-ssr')).toBe(false);
    });

    it('adds, removes, and checks browser custom states', () => {
        const element = document.createElement('marsa-element-test') as TestMarsaElement;

        element.setCustomState('active', true);
        expect(element.hasCustomState('active')).toBe(true);

        element.setCustomState('active', false);
        expect(element.hasCustomState('active')).toBe(false);
    });

    it('reports unsupported custom state operations without masking unrelated errors', () => {
        const element = document.createElement('marsa-element-test') as TestMarsaElement;
        const outdatedStateError = new Error("Custom state must start with '--'.");
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const failingStates = {
            add() {
                throw outdatedStateError;
            },
            delete() {
                throw new Error('Unexpected state failure.');
            },
            has() {
                throw outdatedStateError;
            },
        };
        Object.defineProperty(element, 'attachedInternals', {
            configurable: true,
            value: { states: failingStates },
        });

        expect(() => element.setCustomState('active', true)).not.toThrow();
        expect(element.hasCustomState('active')).toBe(false);
        expect(consoleError).toHaveBeenCalledTimes(2);
        expect(() => element.setCustomState('active', false)).toThrow('Unexpected state failure.');
        consoleError.mockRestore();
    });
});
