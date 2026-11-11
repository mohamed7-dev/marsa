// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarsaIcon } from '../src/components/icon/icon.js';
import iconStyles from '../src/components/icon/icon.styles.js';
import {
    getIconProvider,
    registerIconProvider,
    unregisterIconProvider,
} from '../src/components/icon/registry.js';
import hostStyles from '../src/styles/host.styles.js';

describe('MarsaIcon', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.replaceChildren();
        unregisterIconProvider('reactive-props-test');
        unregisterIconProvider('reactive-props-alternate-test');
    });

    function waitForLoad(icon: HTMLElement): Promise<void> {
        return new Promise(resolve => icon.addEventListener('marsa-load', () => resolve(), { once: true }));
    }

    function stubSvgFetch(): void {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: RequestInfo | URL) => {
                const source = String(input).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
                return new Response(`<svg data-source="${source}" viewBox="0 0 16 16"></svg>`, {
                    status: 200,
                });
            }),
        );
    }

    it('uses the host and icon styles inside its Lit Shadow DOM', () => {
        expect(MarsaIcon.styles).toEqual([hostStyles, iconStyles]);
    });

    it('updates accessibility attributes reactively when the label changes', async () => {
        const icon = document.createElement('marsa-icon') as MarsaIcon;
        document.body.append(icon);
        icon.label = 'Weather';
        await icon.updateComplete;

        expect(icon.getAttribute('role')).toBe('img');
        expect(icon.getAttribute('aria-label')).toBe('Weather');
        expect(icon.hasAttribute('aria-hidden')).toBe(false);

        icon.label = '';
        await icon.updateComplete;

        expect(icon.hasAttribute('role')).toBe(false);
        expect(icon.hasAttribute('aria-label')).toBe(false);
        expect(icon.getAttribute('aria-hidden')).toBe('true');
    });

    it('reacts to name, library, family, variant, and canvas changes', async () => {
        stubSvgFetch();
        const resolvePrimary = vi.fn(() => 'data:image/svg+xml,%3Csvg%20data-provider%3D%22primary%22/%3E');
        const resolveAlternate = vi.fn(
            () => 'data:image/svg+xml,%3Csvg%20data-provider%3D%22alternate%22/%3E',
        );
        registerIconProvider({ name: 'reactive-props-test', resolve: resolvePrimary });
        registerIconProvider({ name: 'reactive-props-alternate-test', resolve: resolveAlternate });

        const icon = document.createElement('marsa-icon') as MarsaIcon;
        document.body.append(icon);
        await icon.updateComplete;

        icon.library = 'reactive-props-test';
        icon.name = 'house';
        icon.family = 'regular';
        icon.variant = 'outline';
        icon.canvas = 'auto';
        const firstLoad = waitForLoad(icon);
        await firstLoad;
        await icon.updateComplete;

        expect(resolvePrimary).toHaveBeenLastCalledWith('house', 'regular', 'outline', true);

        const nextLoad = waitForLoad(icon);
        icon.name = 'star';
        await nextLoad;
        await icon.updateComplete;
        expect(resolvePrimary).toHaveBeenLastCalledWith('star', 'regular', 'outline', true);

        const familyLoad = waitForLoad(icon);
        icon.family = 'filled';
        await familyLoad;
        await icon.updateComplete;
        expect(resolvePrimary).toHaveBeenLastCalledWith('star', 'filled', 'outline', true);

        const variantLoad = waitForLoad(icon);
        icon.variant = 'duotone';
        await variantLoad;
        await icon.updateComplete;
        expect(resolvePrimary).toHaveBeenLastCalledWith('star', 'filled', 'duotone', true);

        const canvasLoad = waitForLoad(icon);
        icon.canvas = 'square';
        await canvasLoad;
        await icon.updateComplete;
        expect(resolvePrimary).toHaveBeenLastCalledWith('star', 'filled', 'duotone', false);

        const libraryLoad = waitForLoad(icon);
        icon.library = 'reactive-props-alternate-test';
        await libraryLoad;
        await icon.updateComplete;
        expect(resolveAlternate).toHaveBeenLastCalledWith('star', 'filled', 'duotone', false);
    });

    it('uses and reacts to src when the selected library has no provider', async () => {
        stubSvgFetch();
        const icon = document.createElement('marsa-icon') as MarsaIcon;
        document.body.append(icon);
        await icon.updateComplete;

        icon.library = 'missing-library';
        icon.src = 'https://icons.example.test/first.svg';
        const firstLoad = waitForLoad(icon);
        await firstLoad;
        await icon.updateComplete;

        expect(icon.shadowRoot?.querySelector('svg')?.getAttribute('data-source')).toBe(icon.src);

        const nextLoad = waitForLoad(icon);
        icon.src = 'https://icons.example.test/second.svg';
        await nextLoad;
        await icon.updateComplete;
        expect(icon.shadowRoot?.querySelector('svg')?.getAttribute('data-source')).toBe(icon.src);
    });

    it('reflects name and presentation props to the host and updates rotation', async () => {
        const icon = document.createElement('marsa-icon') as MarsaIcon;
        document.body.append(icon);
        icon.name = 'arrow-left';
        icon.library = 'default';
        icon.family = 'outlined';
        icon.variant = 'thin';
        icon.rotate = 90;
        icon.flip = 'both';
        icon.canvas = 'roomy';
        await icon.updateComplete;

        expect(icon.getAttribute('name')).toBe('arrow-left');
        expect(icon.getAttribute('library')).toBe('default');
        expect(icon.getAttribute('family')).toBe('outlined');
        expect(icon.getAttribute('variant')).toBe('thin');
        expect(icon.getAttribute('rotate')).toBe('90');
        expect(icon.getAttribute('flip')).toBe('both');
        expect(icon.getAttribute('canvas')).toBe('roomy');
        expect(icon.style.getPropertyValue('--rotate-angle')).toBe('90deg');

        icon.rotate = 0;
        icon.flip = undefined;
        await icon.updateComplete;
        expect(icon.getAttribute('rotate')).toBe('0');
        expect(icon.hasAttribute('flip')).toBe(false);
        expect(icon.style.getPropertyValue('--rotate-angle')).toBe('0deg');
    });

    it('resolves Lucide icons by kebab-case and PascalCase names', async () => {
        const provider = getIconProvider('default');
        expect(provider).toBeDefined();

        const kebabUrl = await provider?.resolve('arrow-left', 'default', '', false);
        const pascalUrl = await provider?.resolve('ArrowLeft', 'default', '', false);

        expect(kebabUrl).toBe(pascalUrl);
        expect(kebabUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
        expect(decodeURIComponent(kebabUrl?.split(',')[1] ?? '')).toContain('stroke="currentColor"');
    });

    it('allows replacing and removing an icon provider', () => {
        const customProvider = {
            name: 'custom-test-provider',
            resolve: () => 'data:image/svg+xml,%3Csvg/%3E',
        };

        registerIconProvider(customProvider);
        expect(getIconProvider(customProvider.name)).toBe(customProvider);

        unregisterIconProvider(customProvider.name);
        expect(getIconProvider(customProvider.name)).toBeUndefined();
    });
});
