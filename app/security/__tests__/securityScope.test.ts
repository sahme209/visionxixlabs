/** @vitest-environment jsdom */
import {createElement} from "react";
import {render,screen,cleanup} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import Page from "../page";
vi.mock("@/components/Navigation",()=>({Navigation:()=>createElement("nav",null,"Site navigation")}));
vi.mock("@/components/Footer",()=>({Footer:()=>createElement("footer",null,"Site footer")}));
vi.mock("next/link",()=>({default:({href,children,...rest}:{href:string;children:React.ReactNode})=>createElement("a",{href,...rest},children)}));
afterEach(cleanup);
it("presents an assessment sequence without claiming universal enforcement",()=>{
 render(createElement(Page));
 expect(screen.getByRole("list",{name:"How to assess an action"})).toBeDefined();
 const stages=screen.getByRole("list",{name:"How to assess an action"}).querySelectorAll(":scope > li");
 expect(stages.length).toBe(5);
 ["Current access","Exact proposal","Independent review","Deliberate execution","Outcome and recovery"].forEach((title,i)=>expect(stages[i].textContent).toContain(title));
 expect(screen.getByText(/full Governance Intelligence coverage and activation are not complete/i)).toBeDefined();
});
it("keeps assurance and AI data limits visible",()=>{
 render(createElement(Page));
 expect(screen.getByRole("heading",{name:"Data and AI boundaries"})).toBeDefined();
 expect(screen.getByText(/no independent certification is claimed/i)).toBeDefined();
 expect(screen.getByText(/no guarantee about provider retention or model training/i)).toBeDefined();
 expect(screen.getByRole("heading",{name:"Current limits"})).toBeDefined();
});
it("offers public evidence guides rather than granting access",()=>{
 render(createElement(Page));
 for(const href of ["/docs/security-model","/docs/permissions-model","/docs/approval-workflow","/docs/audit-logs","/contact"])expect(screen.getAllByRole("link").some(a=>a.getAttribute("href")===href)).toBe(true);
 expect(screen.getAllByRole("link").some(a=>a.getAttribute("href")?.startsWith("/api/"))).toBe(false);
 // The only buttons are the explanation's own stage and pause controls; nothing performs an action.
 for(const b of screen.queryAllByRole("button"))expect(b.closest("ol[aria-label='How to assess an action']")||/flow$/.test(b.textContent??"")).toBeTruthy();
});
