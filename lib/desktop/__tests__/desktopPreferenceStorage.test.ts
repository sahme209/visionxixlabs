/** @vitest-environment jsdom */
import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({invoke:vi.fn()}));vi.mock("@tauri-apps/api/core",()=>({invoke:m.invoke}));
beforeEach(()=>{vi.resetModules();vi.resetAllMocks();});
function deferred(){let resolve!:()=>void;let reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
it("serializes native writes across Settings remounts and reads after pending saves",async()=>{
 const first=deferred();const value={interface_density:"compact",reduce_motion:true,high_contrast:false};
 m.invoke.mockImplementation((command)=>command==="set_preferences"&&m.invoke.mock.calls.filter(call=>call[0]==="set_preferences").length===1?first.promise:Promise.resolve(command==="get_preferences"?value:undefined));
 const {writeDesktopPreferences,readDesktopPreferences}=await import("../../../desktop/src/lib/preferences");
 const one=writeDesktopPreferences({...value,interface_density:"comfortable"} as never),two=writeDesktopPreferences(value as never),read=readDesktopPreferences();
 await vi.waitFor(()=>expect(m.invoke).toHaveBeenCalledTimes(1));expect(m.invoke.mock.calls[0][0]).toBe("set_preferences");
 first.resolve();await Promise.all([one,two,read]);expect(m.invoke.mock.calls.map(call=>call[0])).toEqual(["set_preferences","set_preferences","get_preferences"]);expect(document.documentElement.dataset.density).toBe("compact");
});
it("a failed save does not poison the next explicit write or falsely apply its appearance",async()=>{
 document.documentElement.dataset.density="comfortable";m.invoke.mockRejectedValueOnce(new Error("storage")).mockResolvedValueOnce(undefined);
 const {writeDesktopPreferences}=await import("../../../desktop/src/lib/preferences");
 await expect(writeDesktopPreferences({interface_density:"compact"} as never)).rejects.toThrow("storage");expect(document.documentElement.dataset.density).toBe("comfortable");
 await writeDesktopPreferences({interface_density:"compact"} as never);expect(document.documentElement.dataset.density).toBe("compact");expect(m.invoke).toHaveBeenCalledTimes(2);
});
