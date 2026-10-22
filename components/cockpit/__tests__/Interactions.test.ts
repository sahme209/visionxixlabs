/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SectionTabs } from "../SectionTabs";
import { ConfirmDialog } from "../ConfirmDialog";
afterEach(()=>cleanup());
it("keeps an unsaved profile draft while switching settings panels and supports keyboard tabs",()=>{
 render(createElement(SectionTabs,{label:"Settings",keepMounted:true,items:[{id:"profile",label:"Profile",content:createElement("input",{"aria-label":"Name",defaultValue:"Example"})},{id:"sessions",label:"Sessions",content:"Recorded device list"}]}));
 fireEvent.change(screen.getByRole("textbox",{name:"Name"}),{target:{value:"Unsent draft"}});
 const profile=screen.getByRole("tab",{name:"Profile"});
 fireEvent.keyDown(profile,{key:"ArrowRight"});
 expect(screen.getByRole("tab",{name:"Sessions"}).getAttribute("aria-selected")).toBe("true");
 expect(screen.getByRole("tab",{name:"Sessions"})).toBe(document.activeElement);
 fireEvent.keyDown(screen.getByRole("tab",{name:"Sessions"}),{key:"Home"});
 expect((screen.getByRole("textbox",{name:"Name"}) as HTMLInputElement).value).toBe("Unsent draft");
});
it("contains dialog focus, cancels on Escape, and never confirms implicitly",()=>{
 const cancel=vi.fn(),confirm=vi.fn();
 render(createElement(ConfirmDialog,{title:"Disconnect GitHub?",confirmLabel:"Disconnect",onCancel:cancel,onConfirm:confirm},"Existing evidence is retained."));
 expect(screen.getByRole("button",{name:"Cancel"})).toBe(document.activeElement);
 const last=screen.getByRole("button",{name:"Disconnect"});last.focus();fireEvent.keyDown(last,{key:"Tab"});
 expect(screen.getByRole("button",{name:"Close dialog"})).toBe(document.activeElement);
 fireEvent.keyDown(screen.getByRole("dialog"),{key:"Escape"});
 expect(cancel).toHaveBeenCalledOnce();expect(confirm).not.toHaveBeenCalled();
 expect(document.body.style.overflow).toBe("hidden");
 cleanup();expect(document.body.style.overflow).not.toBe("hidden");
});
it("keeps keyboard focus inside a pending confirmation when every action is disabled",()=>{
 render(createElement(ConfirmDialog,{title:"Pending revoke",confirmLabel:"Revoke",onCancel:vi.fn(),onConfirm:vi.fn(),busy:true},"Updating device access"));
 const dialog=screen.getByRole("dialog",{name:"Pending revoke"});
 expect(document.activeElement).toBe(dialog);
 const event=new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true});
 dialog.dispatchEvent(event);
 expect(event.defaultPrevented).toBe(true);expect(document.activeElement).toBe(dialog);
});
