#!/usr/bin/env node
// Compiles global tokens, shared Shadow DOM classes, and per-component Lit styles.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';
import scss from 'postcss-scss';
import selectorParser from 'postcss-selector-parser';
import * as sass from 'sass';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'src', 'design-system');
const styles = path.join(root, 'src', 'styles');
const componentStyles = path.join(styles, 'components');
fs.mkdirSync(componentStyles, { recursive: true });

const sassOptions = {
    // upstream's partials are written with @import (shared globals, @extend across files)
    silenceDeprecations: [
        'import',
        'global-builtin',
        'color-functions',
        'slash-div',
        'if-function',
        'strict-unary',
    ],
    quietDeps: true,
};

function writeStylesheet(entry, outputName, { removeGlobalTokens = false } = {}) {
    const result = sass.compile(path.join(source, entry), {
        ...sassOptions,
        style: 'expanded',
    });

    const stylesheet = postcss.parse(result.css);
    if (removeGlobalTokens) {
        stylesheet.walkRules(rule => {
            if (/(^|,)\s*:root\b/.test(rule.selector)) {
                rule.remove();
            }
        });
        stylesheet.walkAtRules(rule => {
            if (rule.nodes?.length === 0) {
                rule.remove();
            }
        });
    }

    const css = stylesheet.toString();
    const output = path.join(styles, outputName);
    fs.writeFileSync(output, `${css}\n`);
    console.log(`src/styles/${outputName}  ${(Buffer.byteLength(css) / 1024).toFixed(1)} KiB`);
}

function getPartials(directory, aggregateFile, excluded = []) {
    const aggregate = fs.readFileSync(path.join(source, aggregateFile), 'utf8');
    const imported = [...aggregate.matchAll(/@import\s+['"](?:[^'"]*\/)?([^/'"]+)['"]/g)].map(
        match => match[1],
    );
    const available = fs
        .readdirSync(path.join(source, directory))
        .filter(file => file.startsWith('_') && file.endsWith('.scss'))
        .map(file => file.slice(1, -5))
        .filter(name => !excluded.includes(name));
    const names = [...imported, ...available.filter(name => !imported.includes(name))];
    return names.map(name => path.join(source, directory, `_${name}.scss`));
}

const widgetPartials = getPartials('widgets', '_widgets.scss');
const layoutPartials = getPartials('layout', 'layout/_layouts.scss', ['base', 'layouts']);
const componentPartials = [...widgetPartials, ...layoutPartials];
const partialOrder = new Map(componentPartials.map((file, index) => [file, index]));

function addProvider(providers, name, file) {
    const matches = providers.get(name) ?? [];
    if (!matches.includes(file)) matches.push(file);
    providers.set(name, matches);
}

function addSelectorProviders(providers, selector, file) {
    for (const match of selector.matchAll(/([.%][\w-]+)/g)) {
        addProvider(providers, match[1], file);
    }
}

function getProviders(partials) {
    const providers = new Map();
    for (const file of partials) {
        const stylesheet = scss.parse(fs.readFileSync(file, 'utf8'));
        stylesheet.walkDecls(declaration => {
            if (declaration.prop.startsWith('$')) {
                addProvider(providers, declaration.prop.slice(1), file);
            }
        });
        stylesheet.walkAtRules('mixin', rule => {
            const name = rule.params.match(/^([\w-]+)/)?.[1];
            if (name) addProvider(providers, `mixin:${name}`, file);
        });
        stylesheet.walkRules(rule => addSelectorProviders(providers, rule.selector, file));
        stylesheet.walkAtRules('at-root', rule => addSelectorProviders(providers, rule.params, file));
    }
    return providers;
}

const providers = getProviders(componentPartials);

function findMissingDependency(error) {
    const text = error.span?.text ?? '';
    const extendedSelector = text.match(/@extend\s+([.%][\w-]+)/)?.[1];
    if (extendedSelector) return extendedSelector;

    if (error.sassMessage === 'Undefined variable.') {
        return text.match(/\$([\w-]+)/)?.[1];
    }

    if (error.sassMessage === 'Undefined mixin.') {
        const mixin = text.match(/@include\s+([\w-]+)/)?.[1];
        if (mixin) return `mixin:${mixin}`;
    }

    return undefined;
}

function sassImport(file) {
    return path
        .relative(source, file)
        .replace(/\\/g, '/')
        .replace(/\.scss$/, '')
        .replace(/(^|\/)_/g, '$1');
}

function compilePartial(file) {
    const dependencies = new Set([file]);
    let result;

    // Resolve only the partials that provide this widget's Sass variables, mixins, and extensions.
    for (let attempt = 0; attempt <= componentPartials.length; attempt++) {
        const orderedDependencies = [...dependencies]
            .filter(dependency => dependency !== file)
            .sort((left, right) => partialOrder.get(left) - partialOrder.get(right));
        const imports = [
            "@import 'shared';",
            "@import 'layout/base';",
            ...orderedDependencies.map(dependency => `@import '${sassImport(dependency)}';`),
            `@import '${sassImport(file)}';`,
        ].join('\n');

        try {
            result = sass.compileString(imports, {
                ...sassOptions,
                style: 'expanded',
                loadPaths: [source],
                sourceMap: true,
            });
            break;
        } catch (error) {
            const missingDependency = findMissingDependency(error);
            const provider = providers
                .get(missingDependency)
                ?.find(candidate => !dependencies.has(candidate));
            if (!provider) throw error;
            dependencies.add(provider);
        }
    }

    if (!result) {
        throw new Error(`Could not resolve Sass dependencies for ${path.relative(source, file)}`);
    }
    return result;
}

function decodeMappings(sourceMap) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let sourceIndex = 0;

    function decodeSegment(segment) {
        const values = [];
        let value = 0;
        let shift = 0;

        for (const character of segment) {
            const digit = alphabet.indexOf(character);
            if (digit < 0) throw new Error('Invalid character in Sass source map');
            value += (digit & 31) << shift;
            if (digit & 32) {
                shift += 5;
                continue;
            }
            values.push(value & 1 ? -(value >> 1) : value >> 1);
            value = 0;
            shift = 0;
        }

        if (shift !== 0) throw new Error('Incomplete value in Sass source map');
        return values;
    }

    return sourceMap.mappings.split(';').map(line => {
        let generatedColumn = 0;
        return line
            .split(',')
            .filter(Boolean)
            .map(segment => {
                const values = decodeSegment(segment);
                generatedColumn += values[0];
                if (values.length === 1) return { column: generatedColumn };

                sourceIndex += values[1];
                return {
                    column: generatedColumn,
                    source: sourceMap.sources[sourceIndex],
                };
            });
    });
}

function createPositionLookup(css) {
    const lineStarts = [0];
    for (let index = 0; index < css.length; index++) {
        if (css[index] === '\n') lineStarts.push(index + 1);
    }

    return offset => {
        let low = 0;
        let high = lineStarts.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (lineStarts[middle] <= offset) low = middle + 1;
            else high = middle;
        }
        return {
            line: low,
            column: offset - lineStarts[low - 1],
        };
    };
}

function sourceAt(mappings, line, column) {
    let match;
    for (const segment of mappings[line - 1] ?? []) {
        if (segment.column > column) break;
        match = segment;
    }
    return match?.source;
}

function retainPartialRules(stylesheet, targetSource, mappings, positionForOffset) {
    function filter(container) {
        for (const node of [...(container.nodes ?? [])]) {
            if (node.type === 'rule') {
                const selectors = [];
                // Extensions merge selectors across files; retain only selectors owned by this partial.
                selectorParser(root =>
                    root.each(selector => {
                        const position = positionForOffset(node.source.start.offset + selector.sourceIndex);
                        if (sourceAt(mappings, position.line, position.column) === targetSource) {
                            selectors.push(selector.toString().trim());
                        }
                    }),
                ).processSync(node.selector);

                if (selectors.length === 0) {
                    node.remove();
                    continue;
                }
                node.selector = selectors.join(',\n');
                filter(node);
                continue;
            }

            if (node.type === 'atrule') {
                if (node.nodes) {
                    filter(node);
                    if (node.nodes.length === 0) node.remove();
                    continue;
                }
                const position = positionForOffset(node.source.start.offset);
                if (sourceAt(mappings, position.line, position.column) !== targetSource) {
                    node.remove();
                }
                continue;
            }

            if (node.type === 'decl') {
                if (container.type !== 'rule') {
                    const position = positionForOffset(node.source.start.offset);
                    if (sourceAt(mappings, position.line, position.column) !== targetSource) {
                        node.remove();
                    }
                }
                continue;
            }

            if (node.type === 'comment') {
                const position = positionForOffset(node.source.start.offset);
                if (sourceAt(mappings, position.line, position.column) !== targetSource) {
                    node.remove();
                }
                continue;
            }

            node.remove();
        }
    }

    filter(stylesheet);
}

function writeComponentStyle(file) {
    const result = compilePartial(file);
    const targetSource = pathToFileURL(file).href;
    const stylesheet = postcss.parse(result.css);
    retainPartialRules(
        stylesheet,
        targetSource,
        decodeMappings(result.sourceMap),
        createPositionLookup(result.css),
    );
    const css = stylesheet.toString().trim();
    if (!css) throw new Error(`No CSS rules generated for ${path.relative(source, file)}`);

    const componentName = path.basename(file, '.scss').slice(1);
    const name = `${file.includes(`${path.sep}layout${path.sep}`) ? 'layout-' : ''}${componentName}.styles.ts`;
    const output = path.join(componentStyles, name);
    const module = [
        '// Generated by scripts/build.mjs. Do not edit by hand.',
        "import { css, unsafeCSS } from 'lit';",
        '',
        `export default css\`\${unsafeCSS(${JSON.stringify(css)})}\`;`,
        '',
    ].join('\n');
    fs.writeFileSync(output, module);
    console.log(`src/styles/components/${name}  ${(Buffer.byteLength(css) / 1024).toFixed(1)} KiB`);
}

writeStylesheet('tokens.scss', 'tokens.css');
writeStylesheet('shared.scss', 'common.css', { removeGlobalTokens: true });
const expectedComponentStyles = new Set(
    componentPartials.map(partial => {
        const componentName = path.basename(partial, '.scss').slice(1);
        const prefix = partial.includes(`${path.sep}layout${path.sep}`) ? 'layout-' : '';
        return `${prefix}${componentName}.styles.ts`;
    }),
);
for (const partial of componentPartials) writeComponentStyle(partial);
for (const file of fs.readdirSync(componentStyles)) {
    if (expectedComponentStyles.has(file) || !file.endsWith('.styles.ts')) continue;
    const output = path.join(componentStyles, file);
    if (fs.readFileSync(output, 'utf8').includes('// Generated by scripts/build.mjs.')) {
        fs.unlinkSync(output);
    }
}
