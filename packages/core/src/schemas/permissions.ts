import { z } from 'zod';
import { ApplicationIdSchema } from './identifiers.js';

// keep

export const CapabilitySchema = z.enum([
    'events.publish',
    'events.subscribe',
    'storage.read',
    'storage.write',
    'windows.create',
    'notifications.send',
]);

export type Capability = z.infer<typeof CapabilitySchema>;

export const DeveloperCapabilityGrantSchema = z
    .object({
        appId: ApplicationIdSchema,
        capabilities: z.array(CapabilitySchema).readonly(),
    })
    .strict()
    .readonly();

export const DeveloperCapabilityGrantsSchema = z.array(DeveloperCapabilityGrantSchema).readonly();

export type DeveloperCapabilityGrant = z.infer<typeof DeveloperCapabilityGrantSchema>;
