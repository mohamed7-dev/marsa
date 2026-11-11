import type { IdentifierKindSchema } from '../../schemas/identifiers.js';

declare const identifierBrand: unique symbol;

/**
 * @description
 * Branded type that prevents mixing identifiers for different runtime entities.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type Identifier<Kind extends string> = string & {
    readonly [identifierBrand]: Kind;
};

/**
 * @description
 * Union of all identifier kinds used by the runtime.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type IdentifierKind = IdentifierKindSchema;

/**
 * @description
 * Branded type of an application ID.
 * it distinguishes application {@link Identifier} from other entity {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type ApplicationId = Identifier<'application'>;

/**
 * @description
 * Branded type of an application instance ID.
 * it distinguishes instance {@link Identifier} from application definition {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type ApplicationInstanceId = Identifier<'application-instance'>;

/**
 * @description
 * Branded type of a window ID.
 * it distinguishes window {@link Identifier} from application instance {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type WindowId = Identifier<'window'>;

/**
 * @description
 * Branded type of a workspace ID.
 * it distinguishes workspace {@link Identifier} from other entity {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type WorkspaceId = Identifier<'workspace'>;

/**
 * @description
 * Branded type of an event ID.
 * it distinguishes event {@link Identifier} from other entity {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type EventId = Identifier<'event'>;

/**
 * @description
 * Branded type of a notification ID.
 * it distinguishes notification {@link Identifier} from other entity {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type NotificationId = Identifier<'notification'>;

/**
 * @description
 * Branded type of a correlation ID.
 * it distinguishes correlation {@link Identifier} from other entity {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type CorrelationId = Identifier<'correlation'>;

/**
 * @description
 * Branded type of a permission audit ID.
 * it distinguishes audit {@link Identifier} from runtime operation {@link Identifier}s.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type PermissionAuditId = Identifier<'permission-audit'>;

/**
 * @description
 * A Map of an {@link IdentifierKind} to its corresponding {@link Identifier}
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export type IdentifierByKind = {
    application: ApplicationId;
    'application-instance': ApplicationInstanceId;
    window: WindowId;
    workspace: WorkspaceId;
    event: EventId;
    notification: NotificationId;
    correlation: CorrelationId;
    'permission-audit': PermissionAuditId;
};

/**
 * @description
 * This interface defines the contract of an identifier generator.
 *
 * :::info
 * it Keeps platform-specific identifier generation outside core
 * :::
 *
 * @docsPage core/identifiers
 * @docsCategory Contracts
 * @example
 * ```ts
 * const identifiers: IdentifierGenerator = { generate: kind => createId(kind) };
 * ```
 */
export interface IdentifierGeneratorStrategy {
    /**
     * @description
     * Returns an ID branded for {@link IdentifierKind}.
     * @docsPage core/identifiers
     * @docsCategory Contracts
     * @example
     * ```ts
     * const id = identifiers.generate('application');
     * ```
     */
    generate<Kind extends IdentifierKind>(kind: Kind): IdentifierByKind[Kind];
}
