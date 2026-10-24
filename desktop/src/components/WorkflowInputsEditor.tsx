import { useEffect, useRef, useState } from "react";

type Row = { name: string; value: string };
function parse(value: string): Row[] {
  const object: unknown = JSON.parse(value);
  if (!object || typeof object !== "object" || Array.isArray(object) || Object.values(object).some(item => typeof item !== "string")) {
    throw new Error("Each workflow input must have a text value.");
  }
  return Object.entries(object).map(([name, value]) => ({ name, value: value as string }));
}
function issueFor(rows: Row[]): string | undefined {
  if (rows.some(row => !row.name.trim())) return "Give every input a name, or remove the empty row.";
  if (rows.some(row => row.name !== row.name.trim())) return "Input names cannot start or end with spaces.";
  if (new Set(rows.map(row => row.name)).size !== rows.length) return "Input names must be unique.";
}
function initial(value: string) {
  try { const rows = parse(value); return { rows, issue: issueFor(rows), invalidJson: false }; }
  catch { return { rows: [] as Row[], invalidJson: true, issue: "Repair the workflow inputs JSON below. Existing values have not been discarded." }; }
}

/** Edits manual intake values only; does not discover or dispatch a provider workflow. */
export function WorkflowInputsEditor({ value, onChange, onIssueChange }: {
  value: string; onChange: (value: string) => void; onIssueChange: (issue: string | undefined) => void;
}) {
  const [state, setState] = useState(() => initial(value));
  const [advanced, setAdvanced] = useState(() => Boolean(initial(value).issue));
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const next = initial(value); setState(next);
    if (next.issue) setAdvanced(true);
  }, [value]);
  useEffect(() => { onIssueChange(state.issue); }, [state.issue, onIssueChange]);

  function edit(rows: Row[]) {
    const issue = issueFor(rows); setState({ rows, issue, invalidJson: false });
    if (!issue) {
      const next = JSON.stringify(Object.fromEntries(rows.map(row => [row.name, row.value])), null, 2);
      lastEmitted.current = next; onChange(next);
    }
  }
  function editJson(next: string) {
    lastEmitted.current = next; onChange(next); setState(initial(next));
  }
  const inputClass = "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200";
  return <div className="col-span-2 space-y-3" aria-label="Workflow inputs">
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-xs font-medium text-zinc-200">Workflow inputs</p><p className="mt-1 text-xs text-zinc-500">Enter the fields required by your selected workflow, such as client or region. Names must match that workflow.</p></div>
      <button type="button" disabled={state.invalidJson} onClick={() => edit([...state.rows, { name: "", value: "" }])} className="btn-secondary shrink-0">Add input</button>
    </div>
    {state.rows.length === 0 && !state.issue && <p className="text-xs text-zinc-500">No inputs recorded. Add only the fields your workflow requires.</p>}
    {state.rows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <label className="space-y-1 text-xs text-zinc-400"><span>Name</span><input aria-label={`Input name ${index + 1}`} className={inputClass} value={row.name} onChange={event => edit(state.rows.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label>
      <label className="space-y-1 text-xs text-zinc-400"><span>Value</span><input aria-label={`Input value ${index + 1}`} className={inputClass} value={row.value} onChange={event => edit(state.rows.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} /></label>
      <button type="button" aria-label={`Remove input ${index + 1}`} className="btn-secondary" onClick={() => edit(state.rows.filter((_, i) => i !== index))}>Remove</button>
    </div>)}
    {state.issue && <p role="alert" className="text-xs text-amber-300">{state.issue}</p>}
    <button type="button" className="text-xs text-zinc-400 underline" aria-expanded={advanced} onClick={() => setAdvanced(open => !open)}>Advanced JSON</button>
    {advanced && <label className="block space-y-1 text-xs text-zinc-400"><span>Advanced workflow inputs JSON</span><textarea className={`${inputClass} min-h-24 font-mono`} value={value} onChange={event => editJson(event.target.value)} /></label>}
    <p className="text-[11px] text-zinc-500">These values are recorded with the request for review. Saving intake does not run the workflow.</p>
  </div>;
}
