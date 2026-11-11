import { css } from 'lit';

export default css`
    :host {
        --rotate-angle: 0deg;
        box-sizing: content-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: -0.125em;
    }

    /* Canvas sizing is independent of the icon's font size. */

    /* Fixed width (default): 1.25em × 1em (20 × 16px) */
    :host(:not([canvas])),
    :host([canvas='fixed']) {
        width: 1.25em;
        height: 1em;
        min-width: 1.25em; /* <-- this is what Safari respects for intrinsic */
        min-height: 1em;
    }

    /* Auto: hug the icon's width. */
    :host([canvas='auto']),
    :host([auto-width]:not([canvas])) {
        width: auto;
        height: 1em;
    }

    /* Square: 1.25em × 1.25em (20 × 20px) */
    :host([canvas='square']) {
        width: 1.25em;
        height: 1.25em;
        min-width: 1.25em;
        min-height: 1.25em;
    }

    /* Roomy: 1.5em × 1.5em (24 × 24px) */
    :host([canvas='roomy']) {
        width: 1.5em;
        height: 1.5em;
        min-width: 1.5em;
        min-height: 1.5em;
    }

    /* #endregion */

    svg {
        /* Preserve SVG fill and stroke attributes supplied by the icon provider. */
        height: 1em;
        overflow: visible;
        width: auto;
    }

    /* Rotation */
    :host([rotate]) {
        transform: rotate(var(--rotate-angle, 0deg));
    }

    /* Flipping */
    :host([flip='x']) {
        transform: scaleX(-1);
    }
    :host([flip='y']) {
        transform: scaleY(-1);
    }
    :host([flip='both']) {
        transform: scale(-1, -1);
    }

    /* Rotation and Flipping combined */
    :host([rotate][flip='x']) {
        transform: rotate(var(--rotate-angle, 0deg)) scaleX(-1);
    }
    :host([rotate][flip='y']) {
        transform: rotate(var(--rotate-angle, 0deg)) scaleY(-1);
    }
    :host([rotate][flip='both']) {
        transform: rotate(var(--rotate-angle, 0deg)) scale(-1, -1);
    }
`;
