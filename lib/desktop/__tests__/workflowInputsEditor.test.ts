/** @vitest-environment jsdom */
import { createElement, useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkflowInputsEditor } from "../../../desktop/src/components/WorkflowInputsEditor";
afterEach(cleanup);
function Harness({ initial = '{"client":"Acme","dry_run":"false"}' }: { initial?: string }) {
 const [value, setValue] = useState(initial); const [issue, setIssue] = useState<string>();
 return createElement("div", null, createElement(WorkflowInputsEditor, { value, onChange: setValue, onIssueChange: setIssue }), createElement("output", { "aria-label": "payload" }, value), createElement("button", { disabled: Boolean(issue) }, "Submit"));
}
it("edits named inputs as exact strings without requiring JSON", () => {
 render(createElement(Harness));
 fireEvent.change(screen.getByLabelText('Input value 1'), { target: { value: '001' } });
 expect(JSON.parse(screen.getByLabelText('payload').textContent!)).toEqual({ client: '001', dry_run: 'false' });
});
it("blocks duplicate and blank names without silently replacing values", () => {
 render(createElement(Harness));
 fireEvent.change(screen.getByLabelText('Input name 2'), { target: { value: 'client' } });
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);
 expect(JSON.parse(screen.getByLabelText('payload').textContent!)).toEqual({ client:'Acme', dry_run:'false' });
 fireEvent.change(screen.getByLabelText('Input name 2'), { target: { value: '' } });
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Input name 2'), { target: { value: 'region' } });
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(false);
});
it("adds and removes inputs, preserving empty string values", () => {
 render(createElement(Harness, { initial:'{}' })); fireEvent.click(screen.getByText('Add input'));
 fireEvent.change(screen.getByLabelText('Input name 1'), { target: { value:'client' } });
 expect(JSON.parse(screen.getByLabelText('payload').textContent!)).toEqual({client:''});
 fireEvent.click(screen.getByRole('button',{name:'Remove input 1'}));
 expect(JSON.parse(screen.getByLabelText('payload').textContent!)).toEqual({});
});
it("keeps malformed or non-string legacy JSON visible for repair", () => {
 render(createElement(Harness, {initial:'{"client":42}'}));
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByText('Add input') as HTMLButtonElement).disabled).toBe(true);
 fireEvent.change(screen.getByLabelText('Advanced workflow inputs JSON'), {target:{value:'{"client":"42"}'}});
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(false);
 expect((screen.getByLabelText('Input value 1') as HTMLInputElement).value).toBe('42');
});

it("retains literal special keys without prototype mutation and rejects padded names", () => {
 render(createElement(Harness, {initial:'{}'})); fireEvent.click(screen.getByText('Add input'));
 fireEvent.change(screen.getByLabelText('Input name 1'), {target:{value:'__proto__'}});
 fireEvent.change(screen.getByLabelText('Input value 1'), {target:{value:'literal'}});
 expect(Object.keys(JSON.parse(screen.getByLabelText('payload').textContent!))).toEqual(['__proto__']);
 expect(JSON.parse(screen.getByLabelText('payload').textContent!).__proto__).toBe('literal');
 fireEvent.change(screen.getByLabelText('Input name 1'), {target:{value:' client '}});
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);
});
it("loads an externally replaced request instead of retaining another request's inputs", () => {
 const onChange = () => {}; const onIssueChange = () => {};
 const view = render(createElement(WorkflowInputsEditor, {value:'{"client":"First"}',onChange,onIssueChange}));
 view.rerender(createElement(WorkflowInputsEditor, {value:'{"region":"west"}',onChange,onIssueChange}));
 expect((screen.getByLabelText('Input name 1') as HTMLInputElement).value).toBe('region');
 expect((screen.getByLabelText('Input value 1') as HTMLInputElement).value).toBe('west');
});
