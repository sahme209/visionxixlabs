/** @vitest-environment jsdom */
import {createElement} from "react";
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const m=vi.hoisted(()=>({open:vi.fn()}));
vi.mock("../../../desktop/src/lib/notifications",()=>({openExternal:m.open}));
import {AgentMessageContent} from "../../../desktop/src/components/AgentMessageContent";
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllGlobals();});
it("renders paragraphs, lists, tables and fenced code without collapsing line breaks",()=>{
 const {container}=render(createElement(AgentMessageContent,{text:'## Review\n\nFirst paragraph.\n\n- One\n- Two\n\n| State | Meaning |\n| --- | --- |\n| failed | Observe |\n\n```ts\nconst state = "failed";\nconsole.log(state);\n```'}));
 expect(screen.getByRole("heading",{name:"Review"})).toBeTruthy();expect(screen.getAllByRole("listitem")).toHaveLength(2);expect(screen.getByRole("table")).toBeTruthy();expect(container.querySelector('pre code')?.textContent).toBe('const state = "failed";\nconsole.log(state);\n');
});
it("copies the exact code on intent and reports clipboard failure honestly",async()=>{
 const write=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:write}});
 render(createElement(AgentMessageContent,{text:'```sh\nprintf "test"\n```'}));
 fireEvent.click(screen.getByRole("button",{name:"Copy code"}));await screen.findByRole("button",{name:"Code copied"});expect(write).toHaveBeenCalledExactlyOnceWith('printf "test"\n');
 write.mockRejectedValue(new Error("PRIVATE"));fireEvent.click(screen.getByRole("button",{name:"Code copied"}));await screen.findByText("Could not copy. Select the code to copy it manually.");expect(screen.queryByText("PRIVATE")).toBeNull();
});
it("does not load remote images or execute HTML, and opens only explicit safe HTTPS links",async()=>{
 const {container}=render(createElement(AgentMessageContent,{text:'<img src="https://tracker.invalid/pixel" onerror="steal()" />\n\n![remote](https://tracker.invalid/image)\n\n[Bad](javascript:alert(1)) [Credential](https://user:secret@example.com) [Docs](https://docs.x.ai/developers/tools/function-calling)'}));
 expect(container.querySelector('img')).toBeNull();expect(container.querySelector('script')).toBeNull();
 expect(screen.queryByRole("link",{name:"Bad"})).toBeNull();expect(screen.queryByRole("link",{name:"Credential"})).toBeNull();
 fireEvent.click(screen.getByRole("link",{name:"Docs"}));await waitFor(()=>expect(m.open).toHaveBeenCalledWith('https://docs.x.ai/developers/tools/function-calling'));
});
