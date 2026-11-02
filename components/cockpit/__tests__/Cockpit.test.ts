/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const io=vi.hoisted(()=>({out:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/control/settings",useRouter:()=>({refresh:vi.fn()})}));
vi.mock("next-auth/react",()=>({signOut:io.out}));
vi.mock("next/image",()=>({default:"img"}));
import { CockpitShell } from "../CockpitShell";
import { Catalog } from "../Catalog";
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("keeps cockpit navigation internal, marks active settings, and ends only the browser session",()=>{
 render(createElement(CockpitShell,{email:"person@example.test",workspace:"Test",roles:["viewer"]},"Page content"));
 expect(screen.getByRole("link",{name:"Settings & sessions"}).getAttribute("aria-current")).toBe("page");
 for(const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).toMatch(/^(\/control|\/account\/help|#cockpit-content)/);
 fireEvent.click(screen.getAllByRole("button",{name:"Sign out"})[0]);
 expect(io.out).toHaveBeenCalledWith({callbackUrl:"/"});
});
it("searches actual capabilities and never invents MCP or installed state",()=>{
 render(createElement(Catalog,{unavailable:true,entries:[{id:"scan",name:"AWS Scan",description:"Read infrastructure",kind:"Plugins",status:"Provider setup required",permissions:["cloud:read"]},{id:"skill",name:"Release readiness",description:"Review",kind:"Skills",status:"Unknown",permissions:[]}]}));
 expect(screen.getByText("AWS Scan")).toBeTruthy();
 fireEvent.change(screen.getByRole("textbox",{name:"Search catalog"}),{target:{value:"nonexistent"}});
 expect(screen.queryByText("AWS Scan")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Developer tools (MCP)"}));
 expect(screen.getByRole("status").textContent).toContain("No browser-managed MCP");
 expect(screen.queryByRole("button",{name:/install|connect/i})).toBeNull();
});
it("offers explicit workspace switching without automatically submitting or changing role authority",()=>{
 render(createElement(CockpitShell,{email:"reviewer@example.test",workspace:"Personal",roles:["owner"],currentWorkspace:"personal",workspaceOptions:[{id:"personal",label:"Personal workspace",role:"owner"},{id:"shared",label:"Shared workspace",role:"security_reviewer"}]}));
 const choice=screen.getByRole("combobox",{name:"Active workspace"})as HTMLSelectElement;
 expect(choice.value).toBe("personal");fireEvent.change(choice,{target:{value:"shared"}});
 const button=screen.getByRole("button",{name:"Open workspace"});
 expect(button.closest("form")?.getAttribute("method")).toBe("post");
 expect(button.closest("form")?.getAttribute("action")).toBe("/api/account/workspace");
 expect(screen.getByRole("option",{name:"Shared workspace · security_reviewer"})).toBeTruthy();
});
