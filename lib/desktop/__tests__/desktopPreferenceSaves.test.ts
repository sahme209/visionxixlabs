/** @vitest-environment jsdom */
import {createElement} from "react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const m=vi.hoisted(()=>({read:vi.fn(),write:vi.fn()}));
vi.mock("@tauri-apps/plugin-shell",()=>({open:vi.fn()}));
vi.mock("@tauri-apps/api/core",()=>({invoke:vi.fn()}));
vi.mock("../../../desktop/src/lib/preferences",()=>({readDesktopPreferences:m.read,writeDesktopPreferences:m.write}));
vi.mock("../../../desktop/src/lib/notifications",()=>({markNotificationPrefDirty:vi.fn(),notifyResult:vi.fn()}));
import {SettingsView} from "../../../desktop/src/views/SettingsView";
const prefs={theme:"dark",notifications_enabled:false,reduce_motion:false,high_contrast:false,interface_density:"comfortable",submit_with_command_enter:false,new_message_behavior:"queue"};
const show=()=>render(createElement(SettingsView,{identity:{organizationId:"fixture",capabilities:[]} as never}));
beforeEach(()=>{vi.resetAllMocks();m.read.mockResolvedValue(prefs);m.write.mockResolvedValue(undefined);});afterEach(cleanup);
it("prevents overlapping preference writes and shows when the change is durably saved",async()=>{
 let resolve!:()=>void;m.write.mockReturnValue(new Promise<void>(done=>{resolve=done;}));show();const toggle=await screen.findByRole("switch",{name:"System notifications"});
 await waitFor(()=>expect(toggle.hasAttribute("disabled")).toBe(false));fireEvent.click(toggle);fireEvent.click(toggle);
 expect(m.write).toHaveBeenCalledTimes(1);expect(m.write.mock.calls[0][0].notifications_enabled).toBe(true);expect(screen.getByText("Saving on this computer…")).toBeTruthy();
 await act(async()=>resolve());await screen.findByText("Saved on this computer.");
 fireEvent.click(screen.getByRole("switch",{name:"System notifications"}));expect(m.write).toHaveBeenCalledTimes(2);expect(m.write.mock.calls[1][0].notifications_enabled).toBe(false);
});
it("restores the prior preference and hides raw storage failures",async()=>{
 m.write.mockRejectedValue(new Error("private keychain diagnostic"));show();const toggle=await screen.findByRole("switch",{name:"System notifications"});await waitFor(()=>expect(toggle.hasAttribute("disabled")).toBe(false));fireEvent.click(toggle);
 await screen.findByText("This preference change could not be confirmed. Reopen Settings to check it before making another change.");expect(toggle.getAttribute("aria-checked")).toBe("false");expect(screen.queryByText("private keychain diagnostic")).toBeNull();fireEvent.click(toggle);expect(m.write).toHaveBeenCalledTimes(1);
});
it("keeps local preference controls unavailable if stored settings could not be read",async()=>{
 m.read.mockRejectedValue(new Error("private disk diagnostic"));show();await screen.findByText("Local preferences could not be loaded. Reopen Settings to try again.");expect(screen.getByRole("switch",{name:"System notifications"}).hasAttribute("disabled")).toBe(true);expect(screen.queryByText("private disk diagnostic")).toBeNull();
});
it('groups settings by purpose and filters navigation without saving preferences',async()=>{show();await screen.findByRole('switch',{name:'System notifications'});expect(screen.getByRole('group',{name:'Account & preferences'})).toBeTruthy();expect(screen.getByRole('group',{name:'Agent & security'})).toBeTruthy();expect(screen.getByRole('group',{name:'Development & connections'})).toBeTruthy();fireEvent.change(screen.getByRole('searchbox',{name:'Search settings'}),{target:{value:'notifications'}});expect(screen.getByRole('button',{name:'General'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Models'})).toBeNull();expect(screen.queryByRole('group',{name:'Agent & security'})).toBeNull();expect(m.write).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'General'}));expect(screen.getByRole('button',{name:'Models'})).toBeTruthy();expect(m.write).not.toHaveBeenCalled()});
