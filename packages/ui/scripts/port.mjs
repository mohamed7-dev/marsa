#!/usr/bin/env node
/**
 * Ports the libadwaita GTK stylesheet (src/stylesheet/**) to web-ready SCSS.
 *
 *   node scripts/port.mjs [path-to-libadwaita-checkout]
 *
 * What it does
 *   - GTK node names (button, headerbar, row, ...) become `.adw-<name>` classes
 *   - every style class (.flat, .card, .title-1, ...) becomes `.adw-<name>`
 *   - GTK-only pseudo-classes are mapped to web states (see PSEUDOS)
 *   - GTK-only properties/functions are translated or dropped (see transformDecl)
 *   - icons and image assets are inlined as data URIs and drawn with CSS masks
 *
 * Generated partials go to src/design-system (palette, variables, drawing,
 * common, widgets, assets). Hand-written Sass entry points also live in
 * src/design-system. Do not edit generated files by hand; improve this script
 * instead.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import scss from 'postcss-scss';

const packageRoot = path.resolve(import.meta.dirname, '..');
const upstream = path.resolve(packageRoot, process.argv[2] ?? 'src/design-system/upstream');
const srcDir = path.join(upstream, 'src/stylesheet');
const outDir = path.join(packageRoot, 'src', 'design-system');

if (!fs.existsSync(srcDir)) {
    console.error(`Cannot find ${srcDir}\nUsage: node scripts/port.mjs [path-to-libadwaita]`);
    process.exit(1);
}

let sha = 'unknown';
try {
    sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: upstream }).toString().trim();
} catch {
    sha = 'unknown';
}

const PREFIX = 'adw-';

// GTK CSS node names that appear as type selectors upstream.
const NODES = `
accelerator acceleditor actionbar adaptive-preview arrow avatar banner block block-cursor border
bottom-sheet box button buttoncontent calendar cell check checkbutton child clamp color colorchooser
colorswatch columnview combobox contents cursor-handle dialog dialog-host dimming dnd dndtarget
drag-handle drawing dropdown editablelabel emoji-completion-row entry expander expander-widget
fill filechooser filelistcell filethumbnail flap flowbox flowboxchild floating-sheet frame grid
gridview header headerbar highlight iconview image indicator indicatorbin infobar inline-view-switcher
inspector item label leaflet levelbar link list listview magnifier marks mask menubar menubutton
modelbutton navigation-view notebook outline overlay overlay-split-view overshoot paned paper
pathbar picture placeholder placesidebar placesview plane popover preferencesgroup preferencespage
progress progressbar radio range revealer row rubberband scale scrollbar scrolledwindow searchbar
selection separator shadow sheet shortcut shortcut-label shortcuts-section sidebar slider
sort-indicator spinbutton spinner splitbutton stack stackswitcher stacksidebar statusbar statuspage
switch tab tabbar tabbox tabboxchild tabbutton tabgrid tabgridchild taboverview tabs tabthumbnail
tabview text textview title toast toggle toggle-group tooltip toolbar toolbarview treeexpander
treeview trough undershoot value video view-switcher-sidebar viewport viewswitcher viewswitcherbar
viewswitchertitle widget window windowcontrols windowhandle windowtitle
`
    .split(/\s+/)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

const nodeRe = new RegExp(`(?<![\\w\\-.#:%$&\\\\\\uE000])(${NODES.join('|')})(?![\\w-])`, 'g');

// GTK pseudo-classes without a web equivalent become state classes or ARIA states.
const PSEUDOS = [
    [/:drop\(active\)/g, `.${PREFIX}drop-active`],
    [/:backdrop(?![\w-])/g, `.${PREFIX}backdrop`],
    [/:checked(?![\w-])/g, `:is(:checked, .${PREFIX}checked, [aria-checked='true'], [aria-pressed='true'])`],
    [/:indeterminate(?![\w-])/g, `:is(:indeterminate, .${PREFIX}indeterminate, [aria-checked='mixed'])`],
    [/:disabled(?![\w-])/g, `:is(:disabled, .${PREFIX}disabled, [aria-disabled='true'])`],
    [/:selected(?![\w-])/g, `:is(.${PREFIX}selected, [aria-selected='true'])`],
];

export function mapSelector(sel) {
    const holds = [];
    let s = sel.replace(/#\{[^}]*\}/g, m => {
        holds.push(m);
        return `\uE000${holds.length - 1}\uE001`;
    });
    // style classes (and interpolated classes)
    s = s.replace(/\.(-?[A-Za-z_][\w-]*)/g, (_, n) => `.${PREFIX}${n}`);
    s = s.replace(/\.(?=\uE000)/g, `.${PREFIX}`);
    // node names
    s = s.replace(nodeRe, (_, n) => `.${PREFIX}${n}`);
    // pseudo-classes
    for (const [re, to] of PSEUDOS) s = s.replace(re, to);
    return s.replace(/\uE000(\d+)\uE001/g, (_, i) => holds[+i]);
}

/* ------------------------------------------------------------------ values */

function replaceFunc(value, name, fn) {
    const re = new RegExp(`(?<![\\w-])${name}\\(`, 'g');
    let out = '',
        last = 0,
        m;
    while ((m = re.exec(value))) {
        let depth = 1,
            i = re.lastIndex;
        while (i < value.length && depth) {
            depth += value[i] === '(' ? 1 : value[i] === ')' ? -1 : 0;
            i++;
        }
        out += value.slice(last, m.index) + fn(value.slice(re.lastIndex, i - 1));
        last = i;
        re.lastIndex = i;
    }
    return out + value.slice(last);
}

function splitTop(value) {
    const parts = [];
    let depth = 0,
        cur = '';
    for (const ch of value) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && !depth) {
            parts.push(cur.trim());
            cur = '';
        } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}

function iconInclude(value) {
    const theme = value.match(/-gtk-icontheme\(\s*(['"])([^'"]+)\1\s*\)/);
    if (theme) return `icon('${theme[2]}')`;
    const recolor = value.match(/-gtk-recolor\(\s*url\(\s*["']assets\/([\w-]+)\.svg["']\s*\)\s*\)/);
    // check/radio marks are drawn over the node's own background, so they are
    // painted as a background image instead of a mask.
    if (recolor) return `icon-fg('${recolor[1]}')`;
    if (/^none$/.test(value.trim())) return 'icon-none()';
    return null;
}

/** Returns a replacement node, an array of nodes, `null` to drop, or `undefined` to keep. */
function transformDecl(decl) {
    const { prop } = decl;
    let value = decl.value;

    if (prop === '-gtk-icon-source') {
        const inc = iconInclude(value);
        if (!inc) throw new Error(`Unhandled -gtk-icon-source: ${value}`);
        return postcss.atRule({ name: 'include', params: inc });
    }
    if (prop === '-gtk-icon-size') return decl.clone({ prop: '--icon-size' });
    if (prop === '-gtk-icon-transform') return decl.clone({ prop: 'transform' });
    if (prop === '-gtk-icon-shadow') {
        return decl.clone({
            prop: 'filter',
            value: splitTop(value)
                .map(p => `drop-shadow(${p})`)
                .join(' '),
        });
    }
    if (prop.startsWith('-gtk-')) return null; // icon-weight, icon-palette, ...
    if (prop === 'border-spacing') return decl.clone({ prop: 'gap' });

    if (prop === 'background-image' && value.includes('devel-stripes')) {
        return decl.clone({ value: `asset-url('devel-stripes')` });
    }

    let changed = false;
    if (/(?<![\w-])image\(/.test(value)) {
        value = replaceFunc(value, 'image', inner => `linear-gradient(${inner}, ${inner})`);
        changed = true;
    }
    if (value.includes('-gtk-icon-transform')) {
        value = value.replaceAll('-gtk-icon-transform', 'transform');
        changed = true;
    }
    return changed ? decl.clone({ value }) : undefined;
}

/* ------------------------------------------------------------------- walk */

function inKeyframes(node) {
    for (let p = node.parent; p; p = p.parent)
        if (p.type === 'atrule' && /keyframes$/.test(p.name)) return true;
    return false;
}

function transform(source, { header }) {
    const root = scss.parse(source);

    root.walk(node => {
        if (node.type === 'rule' && !inKeyframes(node)) {
            const indent = (node.raws.before ?? '').split('\n').pop();
            node.selector = node.selectors.map(mapSelector).join(',\n' + indent);
        } else if (node.type === 'atrule') {
            if (node.name === 'at-root' && node.params)
                node.params = node.params
                    .split(',')
                    .map(p =>
                        p.trim().startsWith('%') || p.trim() === '&' ? p.trim() : mapSelector(p.trim()),
                    )
                    .join(', ');
            if (node.name === 'extend' && !node.params.trim().startsWith('%'))
                node.params = mapSelector(node.params.trim());
            if (node.name === 'include' && node.params.startsWith('focus-ring(')) {
                // focus-ring("> trough > slider", $focus-state: '.focused'): selectors passed as strings
                node.params = node.params.replace(
                    /(["'])([^"']*)\1/g,
                    (m, q, str) => q + mapSelector(str) + q,
                );
            }
            if (node.name === 'import') node.remove();
        } else if (node.type === 'decl') {
            if (/^\$.*linked_widgets$/.test(node.prop)) {
                node.value = node.value.replace(/"([^"]*)"/g, (m, s) =>
                    s && !s.startsWith('%') ? `"${mapSelector(s)}"` : m,
                );
                return;
            }
            if (node.prop.startsWith('$')) return;
            const out = transformDecl(node);
            if (out === undefined) return;
            if (out === null) node.remove();
            else node.replaceWith(out);
        }
    });

    return header + root.toString(scss);
}

/* ------------------------------------------------------------------ files */

const banner = from =>
    `// GENERATED by scripts/port.mjs from libadwaita ${sha} (${from}).\n// Do not edit by hand: improve scripts/port.mjs and re-run \`pnpm port:adwaita\`.\n\n`;

const write = (rel, text) => {
    const file = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    console.log(`  wrote src/design-system/${rel}`);
};
const read = rel => fs.readFileSync(path.join(srcDir, rel), 'utf8');

// palette: plain SCSS variables, copied as is
// (GTK's @define-color exports at the end of the file are not CSS: dropped)
write('_palette.scss', banner('_palette.scss') + read('_palette.scss').replace(/^@define-color.*\n/gm, ''));

// colors: only the derived SCSS variables / :root helpers are reused (the
// scheme itself is hand-written in _scheme.scss, GTK's @define-color is not CSS)
{
    const colors = read('_colors.scss');
    const i = colors.indexOf('// Other colors');
    if (i < 0) throw new Error('Cannot find "// Other colors" marker in _colors.scss');
    write('_variables.scss', banner('_colors.scss') + transform(colors.slice(i), { header: '' }));
}

write('_drawing.scss', banner('_drawing.scss') + transform(read('_drawing.scss'), { header: '' }));
write('_common.scss', banner('_common.scss') + transform(read('_common.scss'), { header: '' }));

// widget list, preserving upstream order
const widgets = [...read('_widgets.scss').matchAll(/@import\s+'([^']+)'/g)].map(m => m[1]);
write('_widgets.scss', banner('_widgets.scss') + widgets.map(w => `@import '${w}';`).join('\n') + '\n');
for (const w of widgets) {
    const rel = path.join(path.dirname(w), '_' + path.basename(w) + '.scss');
    write(rel, banner(rel) + transform(read(rel), { header: '' }));
}

// assets: inlined as data URIs
{
    const dir = path.join(srcDir, 'assets');
    const rows = fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.svg'))
        .map(f => {
            const name = path.basename(f, '.svg');
            let svg = fs
                .readFileSync(path.join(dir, f), 'utf8')
                .replace(/<\?xml[^>]*\?>/g, '')
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/<(sodipodi|inkscape|metadata)[\s\S]*?(\/>|<\/\1[^>]*>)/g, '')
                .replace(/\s(inkscape|sodipodi):[\w-]+=("[^"]*"|'[^']*')/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            // GTK recolors the asset with the widget color; on the web it is used as a CSS mask,
            // so only the alpha matters. The stripes are drawn directly as a faint overlay.
            svg = svg.replace(
                /(["'])url\(#gpa:foreground\)\1/g,
                name === 'devel-stripes' ? `'rgb(128,128,128)' fill-opacity='.1'` : `'white'`,
            );
            return `  '${name}': '${encodeURIComponent(svg).replace(/'/g, '%27')}'`;
        });
    write('_assets.scss', banner('assets/*.svg') + `$assets: (\n${rows.join(',\n')}\n);\n`);
}

console.log(`\nPorted libadwaita ${sha}.`);
