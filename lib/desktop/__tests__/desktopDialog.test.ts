/** @vitest-environment jsdom */
import {createElement} from 'react';import {afterEach,expect,it,vi} from 'vitest';import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {DesktopDialog} from '../../../desktop/src/components/DesktopDialog';
afterEach(cleanup);
it('starts at the safe action, traps Tab in both directions, and restores prior focus',()=>{const prior=document.createElement('button');document.body.append(prior);prior.focus();const view=render(createElement(DesktopDialog,{label:'Review',onClose:vi.fn()},createElement('button',null,'Cancel'),createElement('button',null,'Confirm')));const cancel=screen.getByRole('button',{name:'Cancel'}),confirm=screen.getByRole('button',{name:'Confirm'});expect(document.activeElement).toBe(cancel);confirm.focus();fireEvent.keyDown(confirm,{key:'Tab'});expect(document.activeElement).toBe(cancel);fireEvent.keyDown(cancel,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(confirm);view.unmount();expect(document.activeElement).toBe(prior);prior.remove();});
it('closes on Escape without allowing an in-flight action to be mistaken for cancellation',()=>{const close=vi.fn();const view=render(createElement(DesktopDialog,{label:'Review',onClose:close},createElement('button',null,'Cancel')));fireEvent.keyDown(screen.getByRole('alertdialog'),{key:'Escape'});expect(close).toHaveBeenCalledOnce();view.rerender(createElement(DesktopDialog,{label:'Review',onClose:close,busy:true},createElement('button',null,'Cancel')));fireEvent.keyDown(screen.getByRole('alertdialog'),{key:'Escape'});expect(close).toHaveBeenCalledOnce();});

it("prevents the backdrop from taking focus when it dismisses the dialog", () => {
  const close = vi.fn();
  render(createElement(DesktopDialog, {label: "Review", onClose: close}, createElement("button", null, "Close")));
  expect(fireEvent.mouseDown(screen.getByRole("alertdialog").parentElement!)).toBe(false);
  expect(close).toHaveBeenCalledOnce();
});

it("skips hidden and disabled controls and leaves a composing Escape alone", () => {
  const close = vi.fn();
  render(createElement(DesktopDialog, {label: "Leave intake", onClose: close}, [
    createElement("button", {key: "hidden", hidden: true}, "Hidden"),
    createElement("button", {key: "disabled", disabled: true}, "Disabled"),
    createElement("button", {key: "stay"}, "Stay in intake"),
    createElement("button", {key: "leave"}, "Leave without saving"),
  ]));
  const stay = screen.getByRole("button", {name: "Stay in intake"});
  const leave = screen.getByRole("button", {name: "Leave without saving"});
  expect(document.activeElement).toBe(stay);
  fireEvent.keyDown(stay, {key: "Tab", shiftKey: true});
  expect(document.activeElement).toBe(leave);
  expect(fireEvent.keyDown(leave, {key: "Escape", isComposing: true})).toBe(true);
  expect(close).not.toHaveBeenCalled();
});
