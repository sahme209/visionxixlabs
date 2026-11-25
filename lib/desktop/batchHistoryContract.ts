import { z } from "zod";
import { deploymentRequestSummarySchema, savedReleaseLocatorSchema } from "../tauri/deploymentRequestSummary";

const instant = z.string().datetime().refine(value => Number.isFinite(Date.parse(value)));
export const batchHistoryPageSize = 20;
// The recent directory holds up to 50 rows and can append one exact lookup.
export const batchHistoryExclusionLimit = 51;
export const batchHistoryExcludedIdsSchema = z.array(savedReleaseLocatorSchema.shape.id)
  .max(batchHistoryExclusionLimit).refine(ids => new Set(ids).size === ids.length);
export const batchHistoryCursorSchema = z.object({
  id: savedReleaseLocatorSchema.shape.id,
  closedAt: instant,
}).strict();
export type BatchHistoryCursor = z.infer<typeof batchHistoryCursorSchema>;

export const batchHistoryPageSchema = z.object({
  releases: z.array(deploymentRequestSummarySchema).max(batchHistoryPageSize).refine(rows =>
    new Set(rows.map(row => row.id)).size === rows.length && rows.every(row =>
      row.status === "closed" && row.closedAt !== null && (row.releaseContext.batches?.selectedRunCount ?? 0) > 0)),
  nextCursor: batchHistoryCursorSchema.nullable(),
}).strict();
export type BatchHistoryPage = z.infer<typeof batchHistoryPageSchema>;
