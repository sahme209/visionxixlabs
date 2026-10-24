/** @vitest-environment jsdom */
import { createElement, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const m=vi.hoisted(()=>({read:vi.fn(),config:{},revision:0,subscribe:()=>()=>{}}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{getGithubWorkflowInputs:m.read, get config(){return m.config},subscribeContext:m.subscribe,getContextRevision:()=>m.revision}}));
import { WorkflowDefinitionInputs } from '../../../desktop/src/components/WorkflowDefinitionInputs';
const source={repositoryFullName:'acme/app',ref:'main',path:'.github/workflows/deploy.yml',blobSha:'a'.repeat(40)};
const inputs=[{name:'client',type:'choice',required:true,description:'Target client',options:['Acme','Beta']},{name:'dry_run',type:'boolean',required:false,description:'',defaultValue:'false'},{name:'count',type:'number',required:false,description:'',defaultValue:'0'}];
beforeEach(()=>{m.read.mockReset();m.config={};m.revision=0;m.read.mockResolvedValue({ok:true,data:{source,inputs}})});afterEach(cleanup);
function Harness({refName='main', initial='{}',onSourceChange}:{refName?:string;initial?:string;onSourceChange?:(value:typeof source)=>void}){
 const [value,setValue]=useState(initial);const [issue,setIssue]=useState<string>();
 return createElement('div',null,createElement(WorkflowDefinitionInputs,{repositoryFullName:'acme/app',refName,workflowPath:'.github/workflows/deploy.yml',value,onChange:setValue,onIssueChange:setIssue,onSourceChange}),createElement('output',{'aria-label':'payload'},value),createElement('button',{disabled:Boolean(issue)},'Submit'));
}
it('reads selected source and renders declared controls without changing recorded values',async()=>{
 render(createElement(Harness));fireEvent.click(screen.getByText('Read workflow fields'));
 await screen.findByLabelText('client');expect((screen.getByLabelText('client') as HTMLSelectElement).options[1].value).toBe('Acme');
 expect(screen.getByLabelText('dry_run').tagName).toBe('SELECT');expect((screen.getByLabelText('count') as HTMLInputElement).type).toBe('number');
 expect(screen.getByLabelText('payload').textContent).toBe('{}');expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);
 expect(m.read).toHaveBeenCalledWith('acme/app','main','.github/workflows/deploy.yml');
});
it('applies declared false/zero defaults without overwriting existing values and validates choices',async()=>{
 render(createElement(Harness,{initial:'{"client":"Beta","count":"2"}'}));fireEvent.click(screen.getByText('Read workflow fields'));await screen.findByLabelText('client');
 fireEvent.click(screen.getByText('Apply missing defaults'));expect(JSON.parse(screen.getByLabelText('payload').textContent!)).toEqual({client:'Beta',count:'2',dry_run:'false'});
 fireEvent.change(screen.getByLabelText('count'),{target:{value:'0'}});expect(JSON.parse(screen.getByLabelText('payload').textContent!).count).toBe('0');
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(false);
});
it('requires explicit removal of undeclared values rather than discarding them',async()=>{
 render(createElement(Harness,{initial:'{"client":"Acme","old":"retain me"}'}));fireEvent.click(screen.getByText('Read workflow fields'));await screen.findByLabelText('client');
 expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);expect(screen.getByLabelText('payload').textContent).toContain('retain me');
 fireEvent.click(screen.getByRole('button',{name:'Remove undeclared input old'}));expect(JSON.parse(screen.getByLabelText('payload').textContent!)).toEqual({client:'Acme'});
});
it('discards an old source response after the ref changes',async()=>{
 let resolve!:(v:unknown)=>void;m.read.mockReturnValue(new Promise(r=>{resolve=r}));const view=render(createElement(Harness));fireEvent.click(screen.getByText('Read workflow fields'));
 view.rerender(createElement(Harness,{refName:'release'}));await act(async()=>resolve({ok:true,data:{source,inputs}}));expect(screen.queryByLabelText('client')).toBeNull();
});
it('does not accept mismatched provenance or a response from an old credential',async()=>{
 let resolve!:(v:unknown)=>void;m.read.mockReturnValue(new Promise(r=>{resolve=r}));render(createElement(Harness));fireEvent.click(screen.getByText('Read workflow fields'));m.config={changed:true};
 await act(async()=>resolve({ok:true,data:{source,inputs}}));expect(screen.queryByLabelText('client')).toBeNull();
});
it('retains manual values when discovery fails',async()=>{
 m.read.mockResolvedValue({ok:false,error:'unavailable'});render(createElement(Harness,{initial:'{"client":"Acme"}'}));fireEvent.click(screen.getByText('Read workflow fields'));
 await screen.findByText(/Workflow fields could not be verified/);expect((screen.getByLabelText('Input value 1') as HTMLInputElement).value).toBe('Acme');
});

it('allows a fresh read after the credential changes during an old request',async()=>{
 let resolve!:(v:unknown)=>void;m.read.mockReturnValueOnce(new Promise(r=>{resolve=r}));const view=render(createElement(Harness));fireEvent.click(screen.getByText('Read workflow fields'));m.config={changed:true};view.rerender(createElement(Harness));
 expect((screen.getByText('Read workflow fields') as HTMLButtonElement).disabled).toBe(false);
 await act(async()=>resolve({ok:true,data:{source,inputs}}));
});
it('refuses a response whose source does not match the selected workflow',async()=>{
 m.read.mockResolvedValue({ok:true,data:{source:{...source,ref:'other'},inputs}});render(createElement(Harness));fireEvent.click(screen.getByText('Read workflow fields'));await screen.findByText(/Workflow fields could not be verified/);expect(screen.queryByLabelText('client')).toBeNull();
});
it('does not discard invalid manual rows by switching to discovered fields',async()=>{
 render(createElement(Harness));fireEvent.click(screen.getByText('Add input'));
 expect((screen.getByText('Read workflow fields') as HTMLButtonElement).disabled).toBe(true);
 expect(screen.getByLabelText('Input name 1')).toBeTruthy();expect(m.read).not.toHaveBeenCalled();
});
it.each(['0x10',' 2 '])('blocks a manual numeric value that the number control cannot faithfully display: %s',async value=>{
 render(createElement(Harness,{initial:JSON.stringify({client:'Acme',count:value})}));fireEvent.click(screen.getByText('Read workflow fields'));await screen.findByLabelText('count');expect((screen.getByText('Submit') as HTMLButtonElement).disabled).toBe(true);expect(JSON.parse(screen.getByLabelText('payload').textContent!).count).toBe(value);expect((screen.getByLabelText('count') as HTMLInputElement).value).toBe(value);
});

it('reports an observation only after an exact owned read, never after unmount',async()=>{
 const changed=vi.fn();const view=render(createElement(Harness,{onSourceChange:changed}));
 fireEvent.click(screen.getByText('Read workflow fields'));await screen.findByLabelText('client');expect(changed).toHaveBeenCalledWith(source);
 changed.mockClear();let resolve!:(value:unknown)=>void;m.read.mockReturnValue(new Promise(r=>{resolve=r}));fireEvent.click(screen.getByText('Read workflow fields'));view.unmount();
 await act(async()=>resolve({ok:true,data:{source,inputs}}));expect(changed).not.toHaveBeenCalled();
});
