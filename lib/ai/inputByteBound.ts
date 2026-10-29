import { redact } from "@/lib/security/redaction";

/** Server-owned aggregate UTF-8 bound for the actual Gateway prompt and system.
 * This limits input size; it does not estimate tokens or change billing policy. */
export const AI_REQUEST_MAX_INPUT_BYTES = 128 * 1024;

export function boundedAIInput(prompt: string, system?: string): { prompt: string; system?: string } {
  if (typeof prompt !== "string" || system !== undefined && typeof system !== "string") throw new RangeError("AI input must be text");
  const payload = { prompt: redact(prompt), ...(system === undefined ? {} : { system: redact(system) }) };
  if (Buffer.byteLength(payload.prompt, "utf8") + Buffer.byteLength(payload.system ?? "", "utf8") > AI_REQUEST_MAX_INPUT_BYTES) {
    throw new RangeError("AI input exceeds the server byte limit");
  }
  return payload;
}

export function boundedStructuredAIInput(text: string, schemaHint: string) {
  return boundedAIInput(text, `Return valid JSON only. The required shape is: ${schemaHint}`);
}
