import { z } from 'zod';
import type {
    ApplicationId,
    ApplicationInstanceId,
    CorrelationId,
    EventId,
    NotificationId,
    PermissionAuditId,
    WindowId,
    WorkspaceId,
} from '../config/identifiers/identifier-generator.contract.js';

// keep

/**
 * @description
 * Validates all possible identifier kinds.
 * @docsPage core/identifiers
 * @docsCategory Types
 */
export const IdentifierKindSchema = z.enum([
    'application',
    'application-instance',
    'window',
    'workspace',
    'event',
    'notification',
    'correlation',
    'permission-audit',
]);

export type IdentifierKindSchema = z.infer<typeof IdentifierKindSchema>;

function isNonEmptyIdentifier<Value extends string>(value: unknown): value is Value {
    return typeof value === 'string' && value.trim().length > 0;
}

export const ApplicationIdSchema = z.custom<ApplicationId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty application identifier.',
});
export const ApplicationInstanceIdSchema = z.custom<ApplicationInstanceId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty application instance identifier.',
});
export const WindowIdSchema = z.custom<WindowId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty window identifier.',
});
export const WorkspaceIdSchema = z.custom<WorkspaceId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty workspace identifier.',
});
export const EventIdSchema = z.custom<EventId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty event identifier.',
});
export const NotificationIdSchema = z.custom<NotificationId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty notification identifier.',
});
export const CorrelationIdSchema = z.custom<CorrelationId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty correlation identifier.',
});
export const PermissionAuditIdSchema = z.custom<PermissionAuditId>(isNonEmptyIdentifier, {
    message: 'Expected a non-empty permission audit identifier.',
});
