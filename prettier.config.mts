import { type Config } from 'prettier';

export default {
    singleQuote: true,
    tabWidth: 4,
    printWidth: 110,
    trailingComma: 'all',
    arrowParens: 'avoid',
    htmlWhitespaceSensitivity: 'ignore',
    plugins: ['prettier-plugin-organize-imports'],
} satisfies Config;
