/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const io=vi.hoisted(()=>({context:vi.fn(),path:"/control/plans?plan=pro&interval=annual"}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:io.context}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({"x-axiom-cockpit-path":io.path})}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error(url);},usePathname:()=>"/control/settings"}));
vi.mock("next-auth/react",()=>({signOut:vi.fn()}));
vi.mock("next/image",()=>({default:"img"}));
import Layout from "@/app/control/layout";
beforeEach(()=>{vi.clearAllMocks();io.path="/control/plans?plan=pro&interval=annual";});
afterEach(()=>cleanup());
it("preserves checkout review intent when the layout requires authentication",async()=>{
 io.context.mockResolvedValue({isAuthenticated:false,roles:[]});
 await expect(Layout({children:"Hidden"})).rejects.toThrow("/auth/signin?callbackUrl=%2Fcontrol%2Fplans%3Fplan%3Dpro%26interval%3Dannual");
});
it("cannot turn an untrusted return header into an external destination",async()=>{
 io.path="//evil.test/control";io.context.mockResolvedValue({isAuthenticated:false,roles:[]});
 await expect(Layout({children:"Hidden"})).rejects.toThrow("/auth/signin?callbackUrl=%2Fcontrol");
});
it("keeps personal session controls reachable when workspace membership cannot be read",async()=>{
 io.path="/control";io.context.mockResolvedValue({isAuthenticated:true,email:"person@example.test",roles:[]});
 render(await Layout({children:createElement("p",null,"Personal device revocation controls")}));
 expect(screen.getByText("Personal device revocation controls")).toBeTruthy();
 expect(screen.getByRole("link",{name:"Settings & sessions"}).getAttribute("href")).toBe("/control/settings");
});
