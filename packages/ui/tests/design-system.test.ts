import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import buttonsStyles from '../src/styles/components/buttons.styles';
import calendarStyles from '../src/styles/components/calendar.styles';
import boxStyles from '../src/styles/components/layout-box.styles';

const tokens = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const sharedStyles = fs.readFileSync(new URL('../src/styles/common.css', import.meta.url), 'utf8');

describe('design-system component styles', () => {
    it('keeps global tokens in the dedicated stylesheet', () => {
        expect(tokens).toContain('--window-bg-color');
        expect(tokens).toContain('--accent-bg-color');
        expect(tokens).not.toContain('.adw-button');
    });

    it('compiles shared libadwaita classes without global token selectors', () => {
        expect(sharedStyles).toContain('.adw-background');
        expect(sharedStyles).toContain('.adw-icon-dropshadow');
        expect(sharedStyles).not.toContain(':root');
        expect(sharedStyles).not.toContain('.adw-button {');
    });

    it('generates one Lit style module for every widget and layout partial', () => {
        const components = new URL('../src/styles/components/', import.meta.url);
        const widgets = fs
            .readdirSync(new URL('../src/design-system/widgets/', import.meta.url))
            .filter(file => file.startsWith('_') && file.endsWith('.scss'))
            .map(file => `${file.slice(1, -5)}.styles.ts`);
        const layouts = fs
            .readdirSync(new URL('../src/design-system/layout/', import.meta.url))
            .filter(
                file =>
                    file.startsWith('_') &&
                    file.endsWith('.scss') &&
                    !['_base.scss', '_layouts.scss'].includes(file),
            )
            .map(file => `layout-${file.slice(1, -5)}.styles.ts`);

        expect(
            fs
                .readdirSync(components)
                .filter(file => file.endsWith('.styles.ts'))
                .sort(),
        ).toEqual([...widgets, ...layouts].sort());
    });

    it('keeps individual widget and layout styles scoped to their Lit modules', () => {
        expect(buttonsStyles.cssText).toContain('.adw-button');
        expect(buttonsStyles.cssText).not.toMatch(/\.adw-entry\s*\{/);
        expect(calendarStyles.cssText).toContain('.adw-calendar');
        expect(calendarStyles.cssText).not.toMatch(/(?:^|\n)\.adw-button\s*\{/);
        expect(boxStyles.cssText).toContain('.adw-box');
        expect(buttonsStyles.cssText).not.toContain(':root');
        expect(calendarStyles.cssText).not.toContain(':root');
        expect(boxStyles.cssText).not.toContain(':root');
    });
});
