import { icons as lucideIcons, type IconNode } from 'lucide';
import type { MarsaIconProvider } from './registry.js';

function normalizeIconName(name: string): string {
    return name.replace(/[^a-z\d]/gi, '').toLowerCase();
}

function escapeAttribute(value: string | number): string {
    return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function serializeIconNode(node: IconNode): string {
    return node
        .map(([tag, attributes]) => {
            const serializedAttributes = Object.entries(attributes)
                .flatMap(([name, value]) =>
                    value === undefined ? [] : [` ${name}="${escapeAttribute(value)}"`],
                )
                .join('');
            return `<${tag}${serializedAttributes}/>`;
        })
        .join('');
}

const iconDefinitions = new Map<string, IconNode>();
for (const [exportName, definition] of Object.entries(lucideIcons)) {
    const normalizedName = normalizeIconName(exportName);
    if (!iconDefinitions.has(normalizedName)) {
        iconDefinitions.set(normalizedName, definition);
    }
}

/**
 * @description Resolves names from Lucide's icon set as local SVG data URLs.
 * @docsPage ui/icons
 * @docsCategory UI
 */
export const defaultIconProvider: MarsaIconProvider = {
    name: 'default',
    resolve(name) {
        const definition = iconDefinitions.get(normalizeIconName(name));
        if (!definition) return '';

        const svg = [
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"',
            ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
            serializeIconNode(definition),
            '</svg>',
        ].join('');

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    },
};
