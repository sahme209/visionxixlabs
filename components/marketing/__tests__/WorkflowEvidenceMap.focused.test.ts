// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowEvidenceMap } from '../WorkflowEvidenceMap';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const names=['Repository context','Exact proposal','Independent review','Separate requester execution','Recorded outcome and recovery'];
it('keeps five ordered concepts and deliberate selection connected to the explanation',()=>{
 render(createElement(WorkflowEvidenceMap));
 const list=screen.getByRole('list',{name:'Conceptual workflow'});
 expect(within(list).getAllByRole('heading')).toEqual(names.map(name=>within(list).getByRole('heading',{name})));
 const controls=within(list).getAllByRole('button');
 controls.forEach((button,index)=>{
  fireEvent.click(button);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(document.getElementById(button.getAttribute('aria-controls')!)?.getAttribute('aria-labelledby')).toBe(button.id);
  expect(screen.getByRole('region',{name:names[index]})).toBeDefined();
  expect(screen.getByText(/Conceptual illustration · local explanation only/)).toBeDefined();
  expect(screen.getByText(/Check your installed version/)).toBeDefined();
  expect(screen.getByText(/Governance Intelligence remains incomplete/)).toBeDefined();
 });
 expect(screen.getByText(/Confirmed requires recorded evidence/)).toBeDefined();
 expect(screen.getByText(/a plan is not proof of recovery/)).toBeDefined();
});
it('supports deliberate keyboard navigation and leaves focus on the chosen control',()=>{
 render(createElement(WorkflowEvidenceMap));
 const controls=within(screen.getByRole('list',{name:'Conceptual workflow'})).getAllByRole('button');
 controls[0].focus();
 for(const [key,index] of [['ArrowRight',1],['End',4],['ArrowRight',0],['ArrowLeft',4],['Home',0]] as const){
  fireEvent.keyDown(document.activeElement!,{key});
  expect(document.activeElement).toBe(controls[index]);
  expect(controls[index].getAttribute('aria-pressed')).toBe('true');
 }
});
it('has unique DOM relationships across instances and no network or scheduled effects',()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const interval=vi.spyOn(globalThis,'setInterval');
 render(createElement('div',null,createElement(WorkflowEvidenceMap),createElement(WorkflowEvidenceMap)));
 for(const button of screen.getAllByRole('button'))fireEvent.click(button);
 const ids=Array.from(document.querySelectorAll('[id]')).map(el=>el.id);
 expect(new Set(ids).size).toBe(ids.length);
 for(const button of screen.getAllByRole('button'))expect(document.getElementById(button.getAttribute('aria-controls')!)).not.toBeNull();
 expect(fetch).not.toHaveBeenCalled();expect(interval).not.toHaveBeenCalled();
 expect(screen.queryByRole('link')).toBeNull();interval.mockRestore();
});
