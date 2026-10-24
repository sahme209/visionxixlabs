import { expect, it } from "vitest";
import { parseWorkflowDispatchInputs } from "../workflowDispatchInputs";
it("reads workflow-specific fields with exact types, choices and false/zero defaults", () => {
 const fields = parseWorkflowDispatchInputs(`on:
  workflow_dispatch:
    inputs:
      client:
        type: choice
        required: true
        options: [Acme, Beta]
        default: Acme
      dry_run:
        type: boolean
        default: false
      count:
        type: number
        default: 0
      target:
        type: environment
      note:
        description: Release note
`);
 expect(fields).toEqual([
  {name:'client',type:'choice',required:true,description:'',options:['Acme','Beta'],defaultValue:'Acme'},
  {name:'dry_run',type:'boolean',required:false,description:'',defaultValue:'false'},
  {name:'count',type:'number',required:false,description:'',defaultValue:'0'},
  {name:'target',type:'environment',required:false,description:''},
  {name:'note',type:'string',required:false,description:'Release note'},
 ]);
});
it.each(['on: workflow_dispatch','on: [push, workflow_dispatch]','on:\n  workflow_dispatch:'])('allows dispatch without fields: %s',source=>expect(parseWorkflowDispatchInputs(source)).toEqual([]));
it.each([
 'on: push',
 'on:\n  workflow_dispatch:\n    inputs:\n      x: {type: secret}',
 'on:\n  workflow_dispatch:\n    inputs:\n      x: {type: choice, options: []}',
 'on:\n  workflow_dispatch:\n    inputs:\n      x: {type: boolean, default: maybe}',
 'on:\n  workflow_dispatch:\n    inputs:\n      x: {type: choice, options: [a,b], default: c}',
 'on:\n  workflow_dispatch:\n    inputs:\n      x: {required: "false"}',
 'on:\n  workflow_dispatch:\n    inputs:\n      x: {type: string}\n      x: {type: number}',
 'on: &loop [*loop]',
])('rejects ambiguous, unsupported or malformed metadata without guessing: %s',source=>expect(()=>parseWorkflowDispatchInputs(source)).toThrow());
it('bounds source size',()=>expect(()=>parseWorkflowDispatchInputs('x'.repeat(100001))).toThrow());

it.each(['[choice]', '{name: string}', '42', 'true'])('rejects non-string type declarations: %s', type => {
 expect(()=>parseWorkflowDispatchInputs(`on:\n  workflow_dispatch:\n    inputs:\n      x: {type: ${type}}`)).toThrow();
});
