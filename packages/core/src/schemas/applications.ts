import { z } from 'zod';
import {
    ApplicationIdSchema,
    ApplicationInstanceIdSchema,
    WindowIdSchema,
    WorkspaceIdSchema,
} from './identifiers.js';
import { CapabilitySchema } from './permissions.js';

// keep

// Instance Policy
export const InstancePolicySchema = z.enum(['single', 'multiple']);
export type InstancePolicy = z.infer<typeof InstancePolicySchema>;

// Virtualization Priority
export const VirtualizationPrioritySchema = z.enum(['low', 'normal', 'high']);
export type VirtualizationPriority = z.infer<typeof VirtualizationPrioritySchema>;

// Policies
export const VirtualizationPolicySchema = z
    .object({
        enabled: z.boolean(),
        preserveState: z.boolean(),
        priority: VirtualizationPrioritySchema,
    })
    .strict()
    .readonly();
export type VirtualizationPolicy = z.infer<typeof VirtualizationPolicySchema>;

export const ApplicationPoliciesSchema = z
    .object({
        instances: InstancePolicySchema,
        virtualization: VirtualizationPolicySchema.optional(),
    })
    .strict()
    .readonly();
export type ApplicationPolicies = z.infer<typeof ApplicationPoliciesSchema>;

// Application Definition
const applicationMetadataShape = {
    title: z.string().refine(value => value.trim().length > 0),
    description: z.string().optional(),
    icon: z.string().optional(),
    policies: ApplicationPoliciesSchema,
    capabilities: z.array(CapabilitySchema).readonly().optional(),
};

export const ApplicationMetadataSchema = z.object(applicationMetadataShape).strict().readonly();
export type ApplicationMetadata = z.infer<typeof ApplicationMetadataSchema>;

export const ApplicationDefinitionSchema = z
    .object({
        id: ApplicationIdSchema,
        ...applicationMetadataShape,
        bin: z.string().min(1),
    })
    .strict()
    .readonly();
export type ApplicationDefinition = z.infer<typeof ApplicationDefinitionSchema>;

export const InstallApplicationInputSchema = z.object({
    ...applicationMetadataShape,
    bin: z.string().min(1),
});

export type InstallApplicationInputSchema = z.infer<typeof InstallApplicationInputSchema>;

// Application Instance
export const ApplicationInstanceStatusSchema = z.enum([
    'created',
    'loading',
    'mounted',
    'virtualized',
    'closing',
    'closed',
]);
export type ApplicationInstanceStatus = z.infer<typeof ApplicationInstanceStatusSchema>;

export const ApplicationInstanceSchema = z
    .object({
        id: ApplicationInstanceIdSchema,
        appId: ApplicationIdSchema,
        status: ApplicationInstanceStatusSchema,
        createdAt: z.number(),
        lastActiveAt: z.number(),
        windowId: WindowIdSchema.optional(),
        workspaceId: WorkspaceIdSchema.optional(),
    })
    .strict()
    .readonly();
export type ApplicationInstance = z.infer<typeof ApplicationInstanceSchema>;
