import {createHash} from "node:crypto";
import {z} from "zod";

export const SAVED_BOT_TASK_MAX_BYTES = 16 * 1024;
function validUnicode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
const text = (max: number) => z.string().max(max).refine(validUnicode, "Invalid Unicode text");
const contentShape = {
  title: text(200).transform(value => value.trim()).refine(value => value.length > 0, "A task title is required"),
  instruction: text(4000).refine(value => value.trim().length > 0, "A task instruction is required"),
  // Not .default(): newer zod skips the inner max/Unicode checks on a defaulted field.
  context: text(4000).optional().transform(value => value ?? ""),
};
const contentSchema = z.object(contentShape).strict();
export type SavedBotTaskContent = z.infer<typeof contentSchema>;
function bounded(value: SavedBotTaskContent): boolean {
  // Defence in depth: re-check every field here, independent of schema-library behaviour.
  if (![value.title, value.instruction, value.context].every((v) => typeof v === "string" && v.length <= 4000 && validUnicode(v))) return false;
  return Buffer.byteLength(JSON.stringify({title:value.title,instruction:value.instruction,context:value.context}), "utf8") <= SAVED_BOT_TASK_MAX_BYTES;
}
const createSchema = z.object({...contentShape,clientRequestId:z.string().uuid()}).strict().refine(bounded, "Saved task exceeds 16 KiB");
const updateSchema = z.object({...contentShape,expectedVersion:z.number().int().min(0).max(2147483647)}).strict().refine(bounded, "Saved task exceeds 16 KiB");
export type SavedBotTaskCreate = z.infer<typeof createSchema>;
export type SavedBotTaskUpdate = z.infer<typeof updateSchema>;
export function parseSavedBotTaskCreate(value: unknown): SavedBotTaskCreate { return createSchema.parse(value); }
export function parseSavedBotTaskUpdate(value: unknown): SavedBotTaskUpdate { return updateSchema.parse(value); }
export function savedBotTaskContentHash(value: SavedBotTaskContent): string {
  const content = contentSchema.refine(bounded, "Saved task exceeds 16 KiB").parse(value);
  return createHash("sha256").update(JSON.stringify({title:content.title,instruction:content.instruction,context:content.context})).digest("hex");
}
