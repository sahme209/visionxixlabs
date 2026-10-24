import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WorkflowDispatchInput } from "../../../lib/connectors/github/workflowDispatchInputDto";
import { desktopClient } from "../lib/desktopClient";
import { WorkflowInputsEditor } from "./WorkflowInputsEditor";

type Definition = { source: { repositoryFullName: string; ref: string; path: string; blobSha: string }; inputs: WorkflowDispatchInput[] };
function valuesFrom(value: string): Record<string, string> | null {
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.values(parsed).every(value => typeof value === "string") ? parsed as Record<string, string> : null; } catch { return null; }
}
function validNumber(value: string) {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
}
function inputIssue(values: Record<string, string> | null, fields: WorkflowDispatchInput[]) {
  if (!values) return "Repair the workflow inputs JSON before continuing.";
  if (Object.keys(values).some(name => !fields.some(field => field.name === name))) return "Remove inputs not declared by this workflow before continuing.";
  for (const field of fields) {
    const value = Object.prototype.hasOwnProperty.call(values, field.name) ? values[field.name] : "";
    if (field.required && value === "" && field.defaultValue === undefined) return `Complete ${field.name} before continuing.`;
    if (value === "") continue;
    if (field.type === "boolean" && !["true", "false"].includes(value)) return `${field.name} must be true or false.`;
    if (field.type === "number" && !validNumber(value)) return `${field.name} must be a finite number.`;
    if (field.type === "choice" && !field.options?.includes(value)) return `Choose a declared value for ${field.name}.`;
  }
}

/** Provider metadata assists intake only; never authorizes a merge or workflow dispatch. */
export function WorkflowDefinitionInputs({ repositoryFullName, refName, workflowPath, value, onChange, onIssueChange }: {
  repositoryFullName: string; refName: string; workflowPath: string; value: string;
  onChange: (value: string) => void; onIssueChange: (issue: string | undefined) => void;
}) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const key = JSON.stringify([repositoryFullName, refName, workflowPath, revision]);
  const current = useRef(key); current.current = key;
  const [load, setLoad] = useState<{ key: string; status: "loading" | "ready" | "error"; data?: Definition; config: typeof desktopClient.config }>();
  const [manualIssue, setManualIssue] = useState<string>();
  const data = load?.key === key && load.config === desktopClient.config && load.status === "ready" ? load.data : undefined;
  const loading = load?.key === key && load.config === desktopClient.config && load.status === "loading";
  const values = valuesFrom(value);
  const issue = loading ? "Workflow fields are being verified." : data ? inputIssue(values, data.inputs) : manualIssue;
  useEffect(() => { onIssueChange(issue); }, [issue, onIssueChange]);
  const canRead = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repositoryFullName) && Boolean(refName.trim()) && /^\.github\/workflows\/[A-Za-z0-9_][A-Za-z0-9_. -]*\.ya?ml$/.test(workflowPath);
  async function read() {
    if (!canRead || loading || manualIssue) return;
    const owner = key, config = desktopClient.config;
    setLoad({ key: owner, config, status: "loading" });
    try {
      const result = await desktopClient.getGithubWorkflowInputs(repositoryFullName, refName, workflowPath);
      if (current.current !== owner || config !== desktopClient.config) return;
      const source = result.ok ? result.data.source : undefined;
      if (!result.ok || !source || source.repositoryFullName !== repositoryFullName || source.ref !== refName || source.path !== workflowPath || !/^[a-f0-9]{40}$/.test(source.blobSha)) {
        setLoad({ key: owner, config, status: "error" }); return;
      }
      setLoad({ key: owner, config, status: "ready", data: result.data });
    } catch { if (current.current === owner && config === desktopClient.config) setLoad({ key: owner, config, status: "error" }); }
  }
  function change(name: string, next: string) {
    if (!values) return;
    const entries = Object.entries(values).filter(([key]) => key !== name);
    if (next !== "") entries.push([name, next]);
    onChange(JSON.stringify(Object.fromEntries(entries), null, 2));
  }
  function defaults() {
    if (!values || !data) return;
    const merged = new Map(Object.entries(values));
    for (const field of data.inputs) if (!merged.has(field.name) && field.defaultValue !== undefined) merged.set(field.name, field.defaultValue);
    onChange(JSON.stringify(Object.fromEntries(merged), null, 2));
  }
  const inputClass = "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200";
  return <div className="col-span-2 space-y-3">
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-zinc-400">{canRead ? `${repositoryFullName} · ${refName} · ${workflowPath}` : "Record one GitHub repository, source branch, and workflow filename to read its fields."}</p><button type="button" className="btn-secondary shrink-0" disabled={!canRead || loading || Boolean(manualIssue)} onClick={() => void read()}>{loading ? "Reading fields…" : "Read workflow fields"}</button></div>
    {load?.key === key && load.status === "error" && <p role="status" className="text-xs text-amber-300">Workflow fields could not be verified. Your manually recorded inputs are retained.</p>}
    {!data || !values ? <fieldset disabled={loading}><WorkflowInputsEditor value={value} onChange={onChange} onIssueChange={setManualIssue} /></fieldset> : <div className="space-y-3 rounded-lg border border-white/10 p-3">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-zinc-400">Fields read from workflow · {data.source.blobSha.slice(0, 8)}</p><button type="button" onClick={defaults} className="text-xs text-zinc-300 underline">Apply missing defaults</button></div>
      {data.inputs.length === 0 && <p className="text-xs text-zinc-400">This workflow declares no manual inputs.</p>}
      {data.inputs.map(field => {
        const selected = Object.prototype.hasOwnProperty.call(values, field.name) ? values[field.name] : "";
        return <label key={field.name} className="block space-y-1 text-xs text-zinc-400"><span>{field.name}{field.required ? " *" : ""}</span>
          {field.type === "choice" || field.type === "boolean" ? <select aria-label={field.name} value={selected} className={inputClass} onChange={event => change(field.name, event.target.value)}><option value="">Not specified</option>{(field.type === "boolean" ? ["true", "false"] : field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}</select> : <input aria-label={field.name} type={field.type === "number" && (selected === "" || validNumber(selected)) ? "number" : "text"} step={field.type === "number" ? "any" : undefined} className={inputClass} value={selected} onChange={event => change(field.name, event.target.value)} />}
          {field.description && <span className="block">{field.description}</span>}{field.defaultValue !== undefined && <span className="block">Workflow default: {field.defaultValue}</span>}{field.type === "environment" && <span className="block">Use the exact repository environment name. Environment choices are not loaded here.</span>}
        </label>;
      })}
      {Object.keys(values).filter(name => !data.inputs.some(field => field.name === name)).map(name => <div key={name} className="flex items-center justify-between gap-2 text-xs text-amber-300"><span>Undeclared input: {name}</span><button type="button" className="underline" aria-label={`Remove undeclared input ${name}`} onClick={() => change(name, "")}>Remove</button></div>)}
      {issue && <p role="alert" className="text-xs text-amber-300">{issue}</p>}
      <p className="text-[11px] text-zinc-500">This reads fields for intake. Saving the request does not run the workflow.</p>
    </div>}
  </div>;
}
