import type { Preview } from '@storybook/web-components-vite';
import '../src/styles/common.css';
import '../src/styles/tokens.css';

const preview: Preview = {
    parameters: {
        layout: 'centered',
        controls: {
            expanded: true,
        },
    },
};

export default preview;
