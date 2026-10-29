/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountSettingsForm } from "@/components/auth/AccountSettingsForm";
import { DesktopSessionsPanel } from "@/components/auth/DesktopSessionsPanel";
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("requires an explicit confirmation before revoking a paired device",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{sessions:[{id:"device-1",deviceLabel:"Example workstation",platform:"macOS",issuedAt:"2026-10-01",expiresAt:"2026-11-01",lastSeenAt:"2026-10-22",status:"active"}]}}),{status:200}));vi.stubGlobal("fetch",fetcher);
 render(createElement(DesktopSessionsPanel));
 fireEvent.click(await screen.findByRole("button",{name:"Revoke device"}));
 expect(fetcher).toHaveBeenCalledTimes(1);
 expect(screen.getByRole("dialog",{name:"Revoke device access?"})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("keeps duplicate profile submissions and edits blocked until the saved name is confirmed",async()=>{
 let finish!:(value:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal("fetch",fetcher);
 render(createElement(AccountSettingsForm,{initialDisplayName:"Example",email:"person@example.test"}));
 fireEvent.click(screen.getByRole("button",{name:"Save profile"}));
 expect(screen.getByRole("textbox",{name:"Display name"}).hasAttribute("disabled")).toBe(true);
 finish(new Response("{}",{status:200}));
 await waitFor(()=>expect(screen.getByText("Profile saved.")).toBeTruthy());
 expect(fetcher).toHaveBeenCalledTimes(1);
});
it("restores focus to the sessions heading after a confirmed device revocation removes its trigger",async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:{sessions:[{id:"device-1",deviceLabel:"Example workstation",platform:"macOS",issuedAt:"2026-10-01",expiresAt:"2026-11-01",lastSeenAt:"2026-10-22",status:"active"}]}}),{status:200})).mockResolvedValueOnce(new Response("{}",{status:200}));vi.stubGlobal("fetch",fetcher);
 render(createElement(DesktopSessionsPanel));
 const trigger=await screen.findByRole("button",{name:"Revoke device"});trigger.focus();fireEvent.click(trigger);
 fireEvent.click(screen.getByRole("dialog").querySelector('button.bg-rose-400')!);
 await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
 await waitFor(()=>expect(screen.getByRole("heading",{name:"Paired Axiom Agent devices"})).toBe(document.activeElement));
 expect(fetcher).toHaveBeenCalledWith("/api/desktop/session?id=device-1",expect.objectContaining({method:"DELETE"}));
});
