import { z } from "zod";

export const releaseClosureEvidenceSchema = z.object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    reference: z.string().trim().min(1).max(240),
    summary: z.string().trim().min(1).max(2000),
}).strict();

export type ReleaseClosureEvidence = z.infer<typeof releaseClosureEvidenceSchema>;
