import type {
    IdentifierByKind,
    IdentifierGeneratorStrategy,
    IdentifierKind,
} from './identifier-generator.contract.js';

export class DefaultIdentifierGeneratorStrategy implements IdentifierGeneratorStrategy {
    generate<Kind extends IdentifierKind>(): IdentifierByKind[Kind] {
        // TODO: Implement default generator based on nanoid library

        return {} as any;
    }
}
