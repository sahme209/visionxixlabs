import { createHash } from "node:crypto";
import { parseWorkflowDispatchInputs } from "./workflowDispatchInputs";

export interface WorkflowExecutionSource {
  repositoryFullName: string;
  ref: string;
  path: string;
  blobSha: string;
}
type Result = { ok: true; inputs: Record<string, string> } | { ok: false; error: "workflow_execution_contract_invalid" };
const refuse = (): Result => ({ ok: false, error: "workflow_execution_contract_invalid" });
const keys = ["repositoryFullName", "ref", "path", "blobSha"] as const;
export function isWorkflowExecutionSource(input: unknown): input is WorkflowExecutionSource {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  if (keys.some(key => typeof value[key] !== "string")) return false;
  const source = value as unknown as WorkflowExecutionSource;
  return Boolean(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repositoryFullName)
    && source.ref && source.ref === source.ref.trim() && source.ref.length <= 240 && !/[\0\r\n]/.test(source.ref)
    && /^\.github\/workflows\/[A-Za-z0-9_][A-Za-z0-9_. -]{0,150}\.ya?ml$/.test(source.path)
    && /^[a-f0-9]{40}$/.test(source.blobSha));
}

/** Validate against freshly server-read workflow content, never a client-provided schema.
 * This is a data contract only: it does not grant dispatch, environment or approval authority.
 * The caller must re-read the exact source under tenant authorization before execution.
 */
export function validateWorkflowExecutionContract(input: {
  expectedSource: WorkflowExecutionSource;
  currentSource: WorkflowExecutionSource;
  content: string;
  inputs: unknown;
}): Result {
  if (!isWorkflowExecutionSource(input.expectedSource) || !isWorkflowExecutionSource(input.currentSource)
    || keys.some(key => input.expectedSource[key] !== input.currentSource[key])) return refuse();
  if (!input.inputs || typeof input.inputs !== "object" || Array.isArray(input.inputs)) return refuse();
  try {
    if (typeof input.content !== "string" || Buffer.byteLength(input.content, "utf8") > 100_000) return refuse();
    const blobSha = createHash("sha1").update(`blob ${Buffer.byteLength(input.content, "utf8")}\0`).update(input.content).digest("hex");
    if (blobSha !== input.currentSource.blobSha) return refuse();
    const fields = parseWorkflowDispatchInputs(input.content);
    const submitted = Object.entries(input.inputs);
    if (submitted.length > 25 || submitted.some(([, value]) => typeof value !== "string")) return refuse();
    const values = Object.fromEntries(submitted) as Record<string, string>;
    if (Buffer.byteLength(JSON.stringify(values), "utf8") > 65_535) return refuse();
    const declared = new Map(fields.map(field => [field.name, field]));
    if (submitted.some(([name]) => !declared.has(name))) return refuse();
    for (const field of fields) {
      if (!Object.hasOwn(values, field.name)) {
        if (field.required) return refuse();
        continue;
      }
      const value = values[field.name];
      if (value.includes("${{")) return refuse();
      if (field.required && !value.trim()) return refuse();
      if (field.type === "boolean" && value !== "true" && value !== "false") return refuse();
      if (field.type === "number" && (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) return refuse();
      if (field.type === "choice" && !field.options?.includes(value)) return refuse();
      if (field.type === "environment" && (!value.trim() || value !== value.trim() || /[\0\r\n]/.test(value))) return refuse();
    }
    return { ok: true, inputs: values };
  } catch { return refuse(); }
}
