/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ config: { workspace: "original" }, branch: vi.fn(), commit: vi.fn(), pr: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue("/test/repos") }));
vi.mock("../../../desktop/src/lib/preferences", () => ({ readDesktopPreferences: vi.fn().mockResolvedValue(null), writeDesktopPreferences: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: {
 get config() { return mocks.config; }, createGithubBranch: mocks.branch, commitGithubFile: mocks.commit, openGithubPullRequest: mocks.pr,
 listRepositories: vi.fn().mockResolvedValue({ok:true,data:{repositories:[]}}), listBranchPolicies: vi.fn().mockResolvedValue({ok:true,data:{policies:[]}}), listEnvironments: vi.fn().mockResolvedValue({ok:true,data:{environments:[]}}),
} }));
import { SettingsView } from "../../../desktop/src/views/SettingsView";
beforeEach(() => { vi.clearAllMocks(); mocks.config={workspace:"original"}; mocks.branch.mockResolvedValue({ok:true,data:{ref:"refs/heads/axiom/test",sha:"base"}}); mocks.commit.mockResolvedValue({ok:true,data:{sha:"commit",htmlUrl:"https://github.com/test/repo/commit/commit"}}); mocks.pr.mockResolvedValue({ok:true,data:{htmlUrl:"https://github.com/test/repo/pull/1",number:1}}); });
afterEach(cleanup);
function form() {
 render(createElement(SettingsView,{identity:{} as never}));
 fireEvent.click(screen.getByRole("button",{name:"Git & PRs"}));
 const button=screen.getByRole("button",{name:"Create pull request"});
 const scope=within(button.parentElement!.parentElement!);
 for(const [label,value] of Object.entries({Repository:"test/repo","Base branch":"main","New branch name":"axiom/test","File path":"src/test.ts","File content":"export const test = true;","Commit message":"Test change","Pull request title":"Test PR","Pull request description":"Test only"})) fireEvent.change(scope.getByLabelText(label),{target:{value}});
 return {button,scope};
}
it("halts before the next write if workspace changes during branch creation",async()=>{
 let finish!:(value:unknown)=>void; mocks.branch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const {button}=form(); fireEvent.click(button); await waitFor(()=>expect(mocks.branch).toHaveBeenCalledOnce());
 mocks.config={workspace:"different"}; finish({ok:true,data:{ref:"refs/heads/axiom/test",sha:"base"}});
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("workspace changed"));
 expect(mocks.commit).not.toHaveBeenCalled();expect(mocks.pr).not.toHaveBeenCalled();
 expect(screen.getByRole("alert").textContent).toContain("original workspace");
});
it("halts before PR creation if workspace changes during the commit",async()=>{
 let finish!:(value:unknown)=>void; mocks.commit.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const {button}=form(); fireEvent.click(button); await waitFor(()=>expect(mocks.commit).toHaveBeenCalledOnce());
 mocks.config={workspace:"different"}; finish({ok:true,data:{sha:"commit",htmlUrl:"https://github.com/test/repo/commit/commit"}});
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("workspace changed"));expect(mocks.pr).not.toHaveBeenCalled();
});
it("locks the reviewed inputs during the write sequence and shows the successful PR",async()=>{
 let finish!:(value:unknown)=>void;mocks.branch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const {button,scope}=form();fireEvent.click(button);await waitFor(()=>expect(mocks.branch).toHaveBeenCalledOnce());
 expect((scope.getByLabelText("Repository") as HTMLInputElement).disabled).toBe(true);
 expect((scope.getByLabelText("File content") as HTMLTextAreaElement).disabled).toBe(true);
 finish({ok:true,data:{ref:"refs/heads/axiom/test",sha:"base"}});
 await screen.findByRole("link",{name:/View pull request/});expect(mocks.pr).toHaveBeenCalledOnce();
});
it.each(["branch","commit","pr"] as const)("reports an uncertain %s outcome without replay or raw errors",async phase=>{
 mocks[phase].mockResolvedValue({ok:false,error:"private upstream details"});
 const {button}=form();fireEvent.click(button);
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("not confirmed"));
 expect(screen.getByRole("alert").textContent).not.toContain("private upstream details");
 expect(screen.getByRole("alert").textContent).toContain("before retrying");
 expect(mocks.branch).toHaveBeenCalledOnce();
 if(phase==="branch"){expect(mocks.commit).not.toHaveBeenCalled();expect(mocks.pr).not.toHaveBeenCalled();}
 if(phase==="commit"){expect(mocks.commit).toHaveBeenCalledOnce();expect(mocks.pr).not.toHaveBeenCalled();}
 if(phase==="pr")expect(mocks.pr).toHaveBeenCalledOnce();
 expect(screen.getByRole("button",{name:"Create pull request"}).hasAttribute("disabled")).toBe(false);
});
it("stops follow-up writes when the user leaves the Git settings section",async()=>{
 let finish!:(value:unknown)=>void;mocks.branch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const {button}=form();fireEvent.click(button);await waitFor(()=>expect(mocks.branch).toHaveBeenCalledOnce());
 fireEvent.click(screen.getByRole("button",{name:"General"}));await act(async()=>{finish({ok:true,data:{ref:"refs/heads/axiom/test",sha:"base"}});});
 expect(mocks.commit).not.toHaveBeenCalled();expect(mocks.pr).not.toHaveBeenCalled();
});
it("recovers from an unexpected thrown client error without exposing it",async()=>{
 mocks.branch.mockRejectedValue(new Error("secret upstream text"));const {button}=form();fireEvent.click(button);
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("not confirmed"));expect(screen.getByRole("alert").textContent).not.toContain("secret upstream");
 expect(mocks.commit).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"Create pull request"}).hasAttribute("disabled")).toBe(false);
});
it("does not display success from a previous workspace after PR dispatch",async()=>{
 let finish!:(value:unknown)=>void;mocks.pr.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const {button}=form();fireEvent.click(button);await waitFor(()=>expect(mocks.pr).toHaveBeenCalledOnce());
 mocks.config={workspace:"different"};finish({ok:true,data:{htmlUrl:"https://github.com/test/repo/pull/1",number:1}});
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("workspace changed"));expect(screen.queryByRole("link",{name:/View pull request/})).toBeNull();
});
it("does not expose preferences with no runtime consumer while retaining the working PR workflow",()=>{
 form();
 expect(screen.queryByRole("combobox",{name:"Review provider"})).toBeNull();
 expect(screen.queryByRole("combobox",{name:"PR link destination"})).toBeNull();
 expect(screen.queryByRole("switch",{name:"Commit attribution"})).toBeNull();
 expect(screen.queryByRole("switch",{name:"PR attribution"})).toBeNull();
 expect(screen.queryByText("Branch prefix")).toBeNull();
 expect(screen.getByRole("button",{name:"Create pull request"})).toBeTruthy();
});
