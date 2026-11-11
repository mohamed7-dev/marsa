import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../src/components/icon/icon.js';
import type { IconCanvas } from '../src/components/icon/icon.js';

interface IconStoryArgs {
    name: string;
    library: string;
    family: string;
    variant: string;
    src?: string;
    rotate: number;
    flip?: 'x' | 'y' | 'both';
    label: string;
    canvas?: IconCanvas;
}

const meta = {
    title: 'Components/MarsaIcon',
    render: ({ name, library, family, variant, src, rotate, flip, label, canvas }) => html`
        <div
            class="adw-background"
            style="box-sizing: border-box; display: grid; min-height: 12rem; min-width: 20rem; place-items: center; padding: 2rem"
        >
            <marsa-icon
                .name=${name}
                .library=${library}
                .family=${family}
                .variant=${variant}
                .src=${src}
                .rotate=${rotate}
                .flip=${flip}
                .label=${label}
                .canvas=${canvas}
            ></marsa-icon>
        </div>
    `,
    argTypes: {
        name: { control: 'text' },
        library: { control: 'text' },
        family: { control: 'text' },
        variant: { control: 'text' },
        src: { control: 'text' },
        rotate: { control: { type: 'number', min: 0, max: 360, step: 15 } },
        flip: { control: 'inline-radio', options: [undefined, 'x', 'y', 'both'] },
        label: { control: 'text' },
        canvas: {
            control: 'inline-radio',
            options: [undefined, 'fixed', 'auto', 'square', 'roomy'],
        },
    },
} satisfies Meta<IconStoryArgs>;

export default meta;
type Story = StoryObj<IconStoryArgs>;

export const Playground: Story = {
    args: {
        name: 'house',
        library: 'default',
        family: 'default',
        variant: '',
        rotate: 0,
        label: 'Home',
        canvas: 'fixed',
    },
    play: async ({ canvasElement }) => {
        const icon = canvasElement.querySelector('marsa-icon');
        if (!icon) throw new Error('The icon story did not render <marsa-icon>.');
        await icon.updateComplete;
        await icon.setIcon();
    },
};

export const CanvasSizes: Story = {
    render: () => html`
        <div
            class="adw-background"
            style="box-sizing: border-box; display: flex; min-height: 12rem; min-width: 20rem; align-items: center; justify-content: center; gap: 1.5rem; padding: 2rem; font-size: 24px"
        >
            <marsa-icon name="house" label="Fixed canvas" canvas="fixed"></marsa-icon>
            <marsa-icon name="house" label="Automatic canvas" canvas="auto"></marsa-icon>
            <marsa-icon name="house" label="Square canvas" canvas="square"></marsa-icon>
            <marsa-icon name="house" label="Roomy canvas" canvas="roomy"></marsa-icon>
        </div>
    `,
    play: async ({ canvasElement }) => {
        const icons = [...canvasElement.querySelectorAll('marsa-icon')];
        if (icons.length !== 4) throw new Error('Expected four icon canvas examples.');
        await Promise.all(
            icons.map(async icon => {
                await icon.updateComplete;
                await icon.setIcon();
            }),
        );
    },
};
