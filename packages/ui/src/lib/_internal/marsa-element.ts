import { isServer, LitElement, type CSSResultGroup } from 'lit';
import { property } from 'lit/decorators.js';
import hostStyles from '../../styles/host.styles.js';

/**
 * @description
 * Provides Marsa components with shared styles, Lit hydration state, and browser internals.
 * @internal
 */
export class MarsaElement extends LitElement {
    /**
     * @description
     * Additional styles included after the shared host styles.
     * @internal Set on derived components.
     */
    static styleGroup: CSSResultGroup;

    private attachedInternals: ElementInternals | undefined;

    /**
     * @description
     * Indicates whether this element was server-rendered or already has a shadow root.
     * @internal Used by Marsa component lifecycle implementations.
     */
    @property({ type: Boolean, reflect: true, attribute: 'did-ssr' })
    declare didSSR: boolean;

    /**
     * @description
     * Initializes hydration state and attaches the browser-provided element internals.
     * @internal
     */
    constructor() {
        super();
        this.didSSR = isServer || Boolean(this.shadowRoot);

        try {
            this.attachedInternals = this.attachInternals();
        } catch (error) {
            console.error(
                'Element internals are unavailable. Form-associated features and custom states may not work.',
                error,
            );
        }
    }

    /**
     * @description
     * Combines the shared host reset with styles supplied by a derived component.
     * @internal Read by Lit when creating the component's shadow root.
     */
    static get styles(): CSSResultGroup {
        const componentStyles = this.styleGroup;
        const additions = Array.isArray(componentStyles)
            ? componentStyles
            : componentStyles
              ? [componentStyles]
              : [];

        return [hostStyles, ...additions];
    }

    /**
     * @description
     * Returns attached browser internals for internal form-control operations.
     * @internal Throws when the browser does not support or allow ElementInternals.
     */
    protected get elementInternals(): ElementInternals {
        if (!this.attachedInternals) {
            throw new Error('ElementInternals are unavailable for this element.');
        }

        return this.attachedInternals;
    }

    /**
     * @description
     * Adds or removes a custom state on this element's ElementInternals.
     * @internal Used by Marsa controls to synchronize CSS-visible state.
     */
    public setCustomState(name: string, active: boolean): void {
        const states = this.attachedInternals?.states;
        if (!states) {
            return;
        }

        try {
            if (active) {
                states.add(name);
            } else {
                states.delete(name);
            }
        } catch (error) {
            if (String(error).includes("must start with '--'")) {
                console.error(
                    'This browser requires custom state names to start with "--". Update the browser or use a compatible polyfill.',
                    error,
                );
                return;
            }

            throw error;
        }
    }

    /**
     * @description
     * Checks whether a custom state is present on this element.
     * @internal Used by Marsa controls when deriving component state.
     */
    public hasCustomState(name: string): boolean {
        const states = this.attachedInternals?.states;
        if (!states) {
            return false;
        }

        try {
            return states.has(name);
        } catch (error) {
            if (String(error).includes("must start with '--'")) {
                console.error(
                    'This browser requires custom state names to start with "--". Update the browser or use a compatible polyfill.',
                    error,
                );
                return false;
            }

            throw error;
        }
    }
}
