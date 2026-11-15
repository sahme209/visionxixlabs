import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { publicInteractions, publicSummary } from '../../scripts/owned-website-ci.mjs';

const source = readFileSync('scripts/capture-owned-website.mjs', 'utf8');
it('accepts the enabled current manual step without requiring a removed player', () => {
  const start = source.indexOf('function isHomepageManualReady()');
  expect(start).toBeGreaterThanOrEqual(0);
  const helper = source.slice(start, source.indexOf('function readNextBootstrapMarkers()', start));
  const ready = vm.compileFunction(`${helper}; return isHomepageManualReady();`, ['document', 'HTMLButtonElement']);
  class Button { disabled = false; current: string | null = 'step'; getAttribute() { return this.current; } }
  const step = new Button();
  const doc = { readyState: 'complete', querySelector: (selector: string) => selector === '#product-tour' ? {} : step };
  expect(ready(doc, Button)).toBe(true);
  expect(ready({ ...doc, readyState: 'interactive' }, Button)).toBe(false);
  expect(ready({ ...doc, querySelector: () => null }, Button)).toBe(false);
  step.disabled = true; expect(ready(doc, Button)).toBe(false);
  step.disabled = false; step.current = null; expect(ready(doc, Button)).toBe(false);
  expect(ready({ ...doc, querySelector: () => ({ disabled: false, getAttribute: () => 'step' }) }, Button)).toBe(false);
});
it('publishes only the finite manual interaction evidence, without arbitrary page data', () => {
  expect(publicInteractions({ currentInteraction: 'manual_step_check', lastInteraction: 'workspace_story', evidence: ['direct_step_state', 'manual_idle_state_retained', 'manual_idle_state_retained', 'PRIVATE_URL?token=secret'] })).toEqual({ currentInteraction: 'manual_step_check', lastInteraction: 'workspace_story', completedEvidence: ['direct_step_state', 'manual_idle_state_retained'] });
});
it('preserves a bounded current manual-readiness phase and consent checkpoint', () => {
  const summary = publicSummary('a'.repeat(40), { sourceHead: 'a'.repeat(40) }, { homeCapturePhase: 'manual_steps_ready_after_essential_consent', preImageWait: { phase: 'homepage_manual' } }, undefined, undefined);
  expect(summary.preImagePhase).toBe('homepage_manual');
  expect(summary.homeCapturePhase).toBe('manual_steps_ready_after_essential_consent');
});

it('only accepts the current programmatically focusable response as focused', () => {
  const start=source.indexOf('function isWorkflowResponseFocused()');
  expect(start).toBeGreaterThanOrEqual(0);
  const helper=source.slice(start,source.indexOf('function isHomepageManualReady()',start));
  const check=vm.compileFunction(`${helper}; return isWorkflowResponseFocused();`,['document']);
  const response={getAttribute:(name:string)=>name==='tabindex'?'-1':null};
  expect(check({querySelector:()=>response,activeElement:response})).toBe(true);
  expect(check({querySelector:()=>response,activeElement:{}})).toBe(false);
  expect(check({querySelector:()=>null,activeElement:null})).toBe(false);
  expect(check({querySelector:()=>({getAttribute:()=>null}),activeElement:response})).toBe(false);
});
it('retains only fixed inline-action, response-focus and decision-gating evidence',()=>{
 expect(publicInteractions({currentInteraction:'inline_action_check',lastInteraction:'inline_check_output',evidence:['inline_workspace_action_chain','inline_response_focus','inline_approval_gates_continuation','inline_agent_action_chain','PRIVATE_URL?token=secret']})).toEqual({currentInteraction:'inline_action_check',lastInteraction:'inline_check_output',completedEvidence:['inline_workspace_action_chain','inline_response_focus','inline_approval_gates_continuation','inline_agent_action_chain']});
});
