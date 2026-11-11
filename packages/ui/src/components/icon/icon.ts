import { html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MarsaElement } from '../../lib/_internal/marsa-element.js';
import { watch } from '../../lib/_internal/watch.js';
import { MarsaErrorEvent } from '../../lib/events/error.js';
import { MarsaLoadEvent } from '../../lib/events/load.js';
import iconStyles from './icon.styles.js';
import { getDefaultIconFamily, getIconProvider, unwatchIcon, watchIcon } from './registry.js';

const INVALID_SVG = Symbol();
const TRANSIENT_FAILURE = Symbol();
type SVGLoadResult = SVGSVGElement | typeof TRANSIENT_FAILURE | typeof INVALID_SVG;
const svgCache = new Map<string, Promise<SVGLoadResult>>();

/**
 * @description
 * Controls the inline box used to center an icon.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export type IconCanvas = 'fixed' | 'auto' | 'square' | 'roomy';

/**
 * @description
 * Displays an icon in an isolated Shadow DOM, using the selected icon provider.
 * @docsPage ui/icons
 * @docsCategory UI
 */
@customElement('marsa-icon')
export class MarsaIcon extends MarsaElement {
    static styleGroup = iconStyles;
    private hasInitialized = false;

    @state()
    private svg: SVGElement | null = null;

    /**
     * @description
     * Name of the icon to display.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ reflect: true })
    name?: string;

    /**
     * @description
     * Registered icon provider name.
     * Defaults to `default` (Lucide).
     * @default 'default'
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ reflect: true })
    library: string = 'default';

    /**
     * @description
     * Icon family passed to the selected provider.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ reflect: true })
    family: string;

    /**
     * @description
     * Icon variant passed to the selected provider.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ reflect: true })
    variant: string;

    /**
     * @description
     * URL of an SVG source used when no provider is registered for `library`.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property()
    src?: string;

    /**
     * @description
     * Clockwise rotation in degrees.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ type: Number, reflect: true })
    rotate: number = 0;

    /**
     * @description
     * Flips the icon across the horizontal axis, vertical axis, or both.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ type: String, reflect: true })
    flip?: 'x' | 'y' | 'both';

    /**
     * @description
     * Accessible name. An empty label makes the icon decorative.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property()
    label: string = '';

    /**
     * @description
     * Sets the icon's inline canvas. The default is `fixed`; `auto` hugs the icon width, `square` uses a
     * 1.25em square, and `roomy` uses a 1.5em square. All sizes scale with `font-size`.
     * @default 'fixed'
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @property({ reflect: true })
    canvas?: IconCanvas;

    connectedCallback(): void {
        super.connectedCallback();
        watchIcon(this);
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        // unwatch icon
        unwatchIcon(this);
    }

    protected firstUpdated(changedProperties: PropertyValues<this>): void {
        super.firstUpdated(changedProperties);

        if (this.hasAttribute('rotate')) {
            this.style.setProperty('--rotate-angle', `${this.rotate}deg`);
        }

        this.setIcon();
    }

    protected updated(changedProperties: PropertyValues<this>) {
        super.updated(changedProperties);
        // Sometimes (like with SSR -> hydration) mutators don't get applied due to race conditions. This ensures mutators get re-applied.
        const library = getIconProvider(this.library);
        // Set rotate angle whenever rotate attribute is present (not just on change)
        if (this.hasAttribute('rotate')) {
            this.style.setProperty('--rotate-angle', `${this.rotate}deg`);
        }
        const svg = this.shadowRoot?.querySelector('svg');
        if (svg) {
            library?.commitToDom?.(svg, this);
        }
    }

    @watch('label')
    public handleLabelChange() {
        const hasLabel = typeof this.label === 'string' && this.label.length > 0;

        if (hasLabel) {
            this.setAttribute('role', 'img');
            this.setAttribute('aria-label', this.label);
            this.removeAttribute('aria-hidden');
        } else {
            this.removeAttribute('role');
            this.removeAttribute('aria-label');
            this.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * @description
     * Resolves and renders the current icon source.
     * @returns A promise that settles after the icon has been resolved.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    @watch(['family', 'name', 'library', 'variant', 'src', 'canvas'], {
        waitUntilFirstUpdate: true,
    })
    public async setIcon() {
        const { iconUrl, provider, failed } = await this.getIconSource();

        if (!iconUrl) {
            this.svg = null;
            if (failed || this.name) {
                this.dispatchEvent(new MarsaErrorEvent());
            }
            return;
        }

        let pendingSvg = svgCache.get(iconUrl);
        if (!pendingSvg) {
            pendingSvg = this.resolveIcon(iconUrl);
            svgCache.set(iconUrl, pendingSvg);
        }

        const result = await pendingSvg;

        if (result === TRANSIENT_FAILURE) {
            svgCache.delete(iconUrl);
        }

        switch (result) {
            case TRANSIENT_FAILURE:
            case INVALID_SVG:
                this.svg = null;
                this.dispatchEvent(new MarsaErrorEvent());
                break;
            default:
                this.svg = result.cloneNode(true) as SVGElement;
                try {
                    provider?.commitToDom?.(this.svg, this);
                } catch {
                    this.svg = null;
                    this.dispatchEvent(new MarsaErrorEvent());
                    return;
                }
                this.dispatchEvent(new MarsaLoadEvent());
        }
    }

    private async getIconSource() {
        const iconProvider = getIconProvider(this.library);
        const family = this.family || getDefaultIconFamily();

        if (iconProvider) {
            const autoWidth = this.canvas === 'auto';
            try {
                const iconUrl = await iconProvider.resolve(this.name ?? '', family, this.variant, autoWidth);
                return { iconUrl, provider: iconProvider, failed: false };
            } catch {
                return { iconUrl: undefined, provider: iconProvider, failed: true };
            }
        }

        return { iconUrl: this.src, provider: undefined, failed: false };
    }

    private async resolveIcon(url: string): Promise<SVGLoadResult> {
        let fileData: Response;
        try {
            fileData = await fetch(url, { mode: 'cors' });
            if (!fileData.ok) return fileData.status === 410 ? INVALID_SVG : TRANSIENT_FAILURE;
        } catch {
            return TRANSIENT_FAILURE;
        }

        try {
            const parsedDocument = new DOMParser().parseFromString(await fileData.text(), 'text/html');
            const svgEl = parsedDocument.body.firstElementChild;
            if (svgEl?.tagName.toLowerCase() !== 'svg') return INVALID_SVG;

            svgEl.setAttribute('part', 'svg');
            return window.document.adoptNode(svgEl) as SVGSVGElement;
        } catch {
            return INVALID_SVG;
        }
    }

    protected render(): unknown {
        if (this.hasUpdated) {
            return this.svg;
        }
        return html`
            <svg part="svg" width="16" height="16" viewBox="0 0 16 16"></svg>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'marsa-icon': MarsaIcon;
    }
}
