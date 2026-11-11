import { ConfigService } from '../../config/config.service.js';
import type {
    ApplicationId,
    ApplicationInstanceId,
} from '../../config/identifiers/identifier-generator.contract.js';
import type { PersistenceStore } from '../../config/persistence/persistence-adapter.contract.js';
import { Injectable } from '../../infra/ioc-container/injectable.decorator.js';
import { PersistenceService } from '../../persistence/persistence.service.js';
import {
    ErrorReportingService,
    ReportServiceErrors,
    RuntimeErrorReporter,
} from '../../runtime-error-manager/error-reporting.service.js';
import { SafeModeContext } from '../../safe-mode/safe-mode-context.js';
import type { Capability } from '../../schemas/permissions.js';

interface PermissionAuditRecord {
    action: string;
}

@Injectable()
@ReportServiceErrors({ category: 'kernel' })
export class PermissionManager extends ErrorReportingService {
    private readonly grants = new Map<ApplicationId, Set<Capability>>();
    private readonly auditLog: PermissionAuditRecord[] = [];
    private readonly auditWriteFailures: unknown[] = [];
    private readonly auditWrites = new Set<Promise<void>>();
    private readonly auditStore: PersistenceStore;

    constructor(
        errorReporter: RuntimeErrorReporter,
        private readonly persistenceService: PersistenceService,
        private readonly configService: ConfigService,
        private readonly safeModeContext: SafeModeContext,
    ) {
        super(errorReporter);
        this.auditStore = this.persistenceService.persistenceAdapter.store('permission-audit-logs');
    }
    /**
     * @description
     * Returns false when no grant exists or when safe mode is active.
     * @docsPage core/permissions
     * @docsCategory Authorization
     * @example
     * ```ts
     * permissionManager.hasCapability(appId, 'storage.read');
     * ```
     */
    public hasCapability(appId: ApplicationId, capability: Capability): boolean {
        return this.grants.get(appId)?.has(capability) ?? false;
    }

    /**
     * @description
     * Adds a new {@link Capability} to an application.
     *
     * :::info
     * Allows access only when both the application declaration and developer grant permit it
     * :::
     *
     * @docsPage core/permissions
     * @docsCategory Authorization
     * @example
     * ```ts
     * permissionManager.authorize(appId, 'events.publish', declaredCapabilities, instanceId);
     * ```
     */
    public authorize(
        appId: ApplicationId,
        capability: Capability,
        declaredCapabilities: readonly Capability[],
        instanceId?: ApplicationInstanceId,
    ): boolean {
        this.append(appId, capability, 'requested', instanceId);
        const allowed =
            !this.safeModeContext.safeMode &&
            declaredCapabilities.includes(capability) &&
            this.hasCapability(appId, capability);
        this.append(appId, capability, allowed ? 'granted' : 'denied', instanceId);
        return allowed;
    }

    /**
     * @description
     * Removes {@link Capability} from the declared application capabilities.
     *
     * :::info
     * Records the change and returns whether a grant was removed.
     * :::
     *
     * @docsPage core/permissions
     * @docsCategory Revocation
     * @example
     * ```ts
     * permissionManager.revokeCapability(appId, 'events.subscribe');
     * ```
     */
    public revokeCapability(
        appId: ApplicationId,
        capability: Capability,
        instanceId?: ApplicationInstanceId,
    ): boolean {
        const capabilities = this.grants.get(appId);
        if (!capabilities?.delete(capability)) {
            this.append(appId, capability, 'denied', instanceId);
            return false;
        }
        if (capabilities.size === 0) {
            this.grants.delete(appId);
        }
        this.append(appId, capability, 'revoked', instanceId);
        return true;
    }

    /**
     * @description
     * Returns the current session's audit records without sensitive application data.
     * @docsPage core/permissions
     * @docsCategory Auditing
     * @example
     * ```ts
     * const audit = permissionManager.getAuditLog();
     * ```
     */
    public getAuditLog(): readonly PermissionAuditRecord[] {
        if (this.auditWriteFailures.length > 0) {
            throw new AggregateError(
                this.auditWriteFailures.splice(0),
                'One or more permission audit records could not be persisted.',
            );
        }
        return this.auditLog.map(record => ({ ...record }));
    }

    /**
     * @description
     * Waits for queued audit writes and surfaces persistence failures.
     * @docsPage core/permissions
     * @docsCategory Auditing
     * @throws Rejects when audit records or the adapter cannot be flushed.
     */
    public async flushAuditLog(): Promise<void> {
        await Promise.all(
            [...this.auditWrites].map(write =>
                write.then(
                    () => undefined,
                    () => undefined,
                ),
            ),
        );
        const failures = this.auditWriteFailures.splice(0);
        let flushError: unknown;
        try {
            await this.persistenceService.persistenceAdapter.flush();
        } catch (error) {
            flushError = error;
        }
        if (flushError !== undefined) {
            if (failures.includes(flushError)) {
                failures.splice(failures.indexOf(flushError), 1);
            }
            throw new AggregateError(
                [...failures, flushError],
                'One or more permission audit records could not be persisted.',
            );
        }
        if (failures.length > 0) {
            throw new AggregateError(
                failures,
                'One or more permission audit records could not be persisted.',
            );
        }
    }

    private append(
        appId: ApplicationId,
        capability: Capability,
        action: PermissionAuditRecord['action'],
        instanceId?: ApplicationInstanceId,
    ): void {
        const record = Object.freeze({
            id: this.configService.identifierOptions.generator.generate('permission-audit'),
            appId,
            ...(instanceId === undefined ? {} : { instanceId }),
            capability,
            action,
            timestamp: this.configService.timeOptions.provider.now(),
        });
        this.auditLog.push(record);
        const write = this.auditStore.write(record.id, {
            schemaVersion: 1,
            value: record,
        });
        this.auditWrites.add(write);
        void write.then(
            () => {
                this.auditWrites.delete(write);
            },
            error => {
                this.auditWriteFailures.push(error);
                this.auditWrites.delete(write);
            },
        );
    }
}
