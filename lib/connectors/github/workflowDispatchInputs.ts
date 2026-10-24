import { parseDocument } from "yaml";

export interface WorkflowDispatchInput {
  name: string;
  type: "string" | "boolean" | "number" | "choice" | "environment";
  required: boolean;
  description: string;
  options?: string[];
  defaultValue?: string;
}
const invalid = () => new Error("workflow_input_schema_unavailable");
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Untrusted workflow metadata only. Never evaluates expressions or grants execution authority. */
export function parseWorkflowDispatchInputs(source: string): WorkflowDispatchInput[] {
  if (Buffer.byteLength(source, "utf8") > 100_000) throw invalid();
  const doc = parseDocument(source, { version: "1.2", uniqueKeys: true, strict: true });
  if (doc.errors.length || doc.warnings.length) throw invalid();
  let root: unknown;
  try { root = doc.toJS({ maxAliasCount: 0 }); } catch { throw invalid(); }
  if (!record(root)) throw invalid();
  const trigger = root.on;
  if (trigger === "workflow_dispatch" || (Array.isArray(trigger) && trigger.every(item => typeof item === "string") && trigger.includes("workflow_dispatch"))) return [];
  if (!record(trigger) || !Object.hasOwn(trigger, "workflow_dispatch")) throw invalid();
  const dispatch = trigger.workflow_dispatch;
  if (dispatch === null) return [];
  if (!record(dispatch)) throw invalid();
  if (dispatch.inputs === undefined) return [];
  if (!record(dispatch.inputs)) throw invalid();
  const entries = Object.entries(dispatch.inputs);
  if (entries.length > 25) throw invalid();
  return entries.map(([name, raw]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,99}$/.test(name) || !record(raw)) throw invalid();
    const type = raw.type ?? "string";
    if (typeof type !== "string" || !["string", "boolean", "number", "choice", "environment"].includes(type)) throw invalid();
    if (raw.required !== undefined && typeof raw.required !== "boolean") throw invalid();
    if (raw.description !== undefined && (typeof raw.description !== "string" || raw.description.length > 2000)) throw invalid();
    const field: WorkflowDispatchInput = { name, type: type as WorkflowDispatchInput["type"], required: raw.required === true, description: typeof raw.description === "string" ? raw.description : "" };
    if (type === "choice") {
      if (!Array.isArray(raw.options) || raw.options.length === 0 || raw.options.length > 100 || raw.options.some(item => typeof item !== "string" || item.length > 2000) || new Set(raw.options).size !== raw.options.length) throw invalid();
      field.options = raw.options as string[];
    } else if (raw.options !== undefined) throw invalid();
    if (Object.hasOwn(raw, "default")) {
      const value = raw.default;
      if (type === "boolean" ? typeof value !== "boolean" : type === "number" ? typeof value !== "number" || !Number.isFinite(value) : typeof value !== "string") throw invalid();
      const text = String(value);
      if (text.length > 2000 || text.includes("${{")) throw invalid();
      if (field.options && !field.options.includes(text)) throw invalid();
      field.defaultValue = text;
    }
    return field;
  });
}
