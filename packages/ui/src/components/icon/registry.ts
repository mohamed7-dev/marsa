import { defaultIconProvider } from './default-library.js';
import type { MarsaIcon } from './icon.js';

/**
 * @description Resolves an icon name to a URL containing its SVG markup.
 * @param name Icon name to resolve.
 * @param family Requested icon family.
 * @param variant Requested icon variant.
 * @param autoWidth Whether the icon should use its natural width.
 * @returns An SVG URL, immediately or asynchronously.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export type MarsaIconProviderResolver = (
    name: string,
    family: string,
    variant: string,
    autoWidth: boolean,
) => string | Promise<string>;

/**
 * @description Applies provider-specific SVG attributes after an icon is loaded.
 * @param svg Loaded SVG element to update.
 * @param icon Marsa icon that requested the SVG.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export type MarsaIconProviderCommit = (svg: SVGElement, icon?: MarsaIcon) => void;

/**
 * @description Provides SVG sources and optional SVG customization for a group of icons.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export interface MarsaIconProvider {
    /**
     * @description Unique name used by the `library` property of @link{MarsaIcon}.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    name: string;

    /**
     * @description Resolves the icon name and presentation options to an SVG URL.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    resolve: MarsaIconProviderResolver;

    /**
     * @description Applies provider-specific attributes to a loaded SVG element.
     * @docsPage ui/icons
     * @docsCategory UI
     */
    commitToDom?: MarsaIconProviderCommit;
}

let defaultIconFamily = 'default';
const iconProviders: MarsaIconProvider[] = [defaultIconProvider];
const watchedIcons = new Set<MarsaIcon>();

/**
 * @description Registers or replaces an icon provider and refreshes icons using it.
 * @param provider Provider definition to register.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export function registerIconProvider(provider: MarsaIconProvider): void {
    unregisterIconProvider(provider.name);
    iconProviders.push(provider);

    watchedIcons.forEach(icon => {
        if (icon.library === provider.name) {
            void icon.setIcon();
        }
    });
}

/**
 * @description Removes a registered icon provider.
 * @param name Registered provider name.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export function unregisterIconProvider(name: string): void {
    const remainingProviders = iconProviders.filter(provider => provider.name !== name);
    iconProviders.splice(0, iconProviders.length, ...remainingProviders);
}

/**
 * @description Gets a provider registered under the given name.
 * @param name Provider name to look up.
 * @returns The matching provider, if registered.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export function getIconProvider(name?: string): MarsaIconProvider | undefined {
    return iconProviders.find(provider => provider.name === name);
}

/**
 * @description Gets the family used when an icon does not specify one.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export function getDefaultIconFamily(): string {
    return defaultIconFamily;
}

/**
 * @description Sets the default icon family and refreshes registered icons.
 * @param family Family name to use for icons without an explicit family.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export function setDefaultIconFamily(family: string): void {
    defaultIconFamily = family;
    watchedIcons.forEach(icon => void icon.setIcon());
}

export function watchIcon(icon: MarsaIcon): void {
    watchedIcons.add(icon);
}

export function unwatchIcon(icon: MarsaIcon): void {
    watchedIcons.delete(icon);
}
