# @marsa/ui

Framework-independent Marsa Web Components and design system.

The stylesheet design system is a browser-oriented port of GNOME libadwaita. It does not depend on `@marsa/core` or a UI framework. See [package boundaries](../README.md).

Run `pnpm sync:adwaita` from this package to fetch the upstream source, port its stylesheet Sass, compile global tokens and shared class styles into `src/styles/`, generate per-widget Lit style modules in `src/styles/components/`, and check the output. The generated Sass lives in `src/design-system`; do not edit generated files by hand.

Run `pnpm storybook` from this package to browse the UI stories locally. `pnpm storybook:build` creates a static Storybook site in `storybook-static/`.

`<marsa-icon>` is a Lit custom element with Lucide as its default icon provider. `<marsa-button>` wraps a native button and supports libadwaita style variants, shapes, and a default content slot. Global theme custom properties and color-scheme metadata are in `src/styles/tokens.css`. `src/styles/common.css` contains shared libadwaita classes and may be included in a component's Shadow DOM. Each widget's Sass is compiled into a Lit style module for that widget's Shadow DOM. CSS files are not public package exports.

`<marsa-button>` is a basic action button. It supports `variant="regular|flat|suggested|destructive|opaque|osd"` and `appearance="regular|pill|circular"`, both defaulting to `regular`. These properties only select visual styles. The component also supports native `disabled` and `autofocus` behavior.

The button exposes one unnamed default slot. Slot content must satisfy HTML button content rules (phrasing content, with no nested interactive controls). Buttons are actions, not links; use an anchor for navigation. The inner native button always has `type="button"`. `<marsa-button>` is not form-associated and does not provide submit/reset, name/value, toggle, menu, disclosure, or drop-target behavior. Use a native `<button>` when native form submission semantics are required. Context-specific button patterns should be implemented as separate components.

```ts
import '@marsa/ui';
```

Icon providers can be replaced with `registerIconProvider`. The default provider accepts Lucide icon names in kebab-case or PascalCase and embeds SVG data URLs from bundled Lucide definitions; no separate icon asset request is expected in the Network panel.
