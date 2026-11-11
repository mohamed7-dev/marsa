import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../src/components/button/button.js';
import type { ButtonAppearance, ButtonVariant } from '../src/components/button/button.js';
import '../src/components/icon/icon.js';

const variants: ButtonVariant[] = ['regular', 'flat', 'suggested', 'destructive', 'opaque', 'osd'];
const appearances: ButtonAppearance[] = ['regular', 'pill', 'circular'];

interface ButtonStoryArgs {
    variant: ButtonVariant;
    appearance: ButtonAppearance;
    disabled: boolean;
}

const meta = {
    title: 'Components/MarsaButton',
    render: ({ variant, appearance, disabled }) => html`
        <div class="adw-background" style="padding: 2rem">
            <marsa-button .variant=${variant} .appearance=${appearance} .disabled=${disabled}>
                ${buttonContent(appearance)}
            </marsa-button>
        </div>
    `,
    argTypes: {
        variant: { control: 'select', options: variants },
        appearance: { control: 'select', options: appearances },
        disabled: { control: 'boolean' },
    },
} satisfies Meta<ButtonStoryArgs>;

function buttonContent(appearance: ButtonAppearance) {
    if (appearance === 'circular') {
        return html`
            <marsa-icon name="settings" label="Settings"></marsa-icon>
        `;
    }

    return 'Save';
}

export default meta;
type Story = StoryObj<ButtonStoryArgs>;

export const Playground: Story = {
    args: {
        variant: 'regular',
        appearance: 'regular',
        disabled: false,
    },
};

export const EveryCombination: Story = {
    render: () => html`
        <div class="adw-background" style="padding: 1.5rem">
            <div
                style="display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 1rem"
            >
                ${variants.flatMap(variant =>
                    appearances.map(
                        appearance => html`
                            <div
                                style="display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; min-height: 5rem"
                            >
                                <small>${variant} / ${appearance}</small>
                                <marsa-button .variant=${variant} .appearance=${appearance}>
                                    ${buttonContent(appearance)}
                                </marsa-button>
                            </div>
                        `,
                    ),
                )}
            </div>
        </div>
    `,
};

export const Disabled: Story = {
    render: () => html`
        <div class="adw-background" style="padding: 2rem">
            <marsa-button disabled>Disabled</marsa-button>
        </div>
    `,
};
