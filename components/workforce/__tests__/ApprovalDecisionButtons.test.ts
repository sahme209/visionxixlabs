/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const f=vi.hoisted(()=>({fetch:vi.fn(),refresh:vi.fn()}));vi.mock("next/navigation",()=>({useRouter:()=>({refresh:f.refresh})}));
import { ApprovalDecisionButtons } from "../ApprovalDecisionButtons";
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal("fetch",f.fetch);f.fetch.mockResolvedValue({ok:true,json:async()=>({ok:true})});});afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it("disables approval when the exact required review is unavailable",()=>{
 render(createElement(ApprovalDecisionButtons,{approvalId:"approval",status:"pending",reviewRequired:true} as never));
 expect((screen.getByRole("button",{name:"Approve"}) as HTMLButtonElement).disabled).toBe(true);
 expect((screen.getByRole("button",{name:"Reject"}) as HTMLButtonElement).disabled).toBe(false);
});
it("echoes the reviewed artifact fingerprint with the approval action",async()=>{
 render(createElement(ApprovalDecisionButtons,{approvalId:"approval",status:"pending",reviewRequired:true,reviewDigest:"a".repeat(64)} as never));fireEvent.click(screen.getByRole("button",{name:"Approve"}));
 await waitFor(()=>expect(f.fetch).toHaveBeenCalledOnce());expect(JSON.parse(f.fetch.mock.calls[0][1].body)).toMatchObject({decision:"approved",reviewDigest:"a".repeat(64)});
});
