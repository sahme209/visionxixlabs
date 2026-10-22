/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const io=vi.hoisted(()=>({context:vi.fn(),member:vi.fn(),members:vi.fn(),users:vi.fn()}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:io.context}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw Error(url);}}));
vi.mock("@/lib/db",()=>({prisma:{orgMembership:{findUnique:io.member,findMany:io.members},user:{findMany:io.users}}}));
import MembersPage from "@/app/control/members/page";
beforeEach(()=>{vi.resetAllMocks();io.context.mockResolvedValue({isAuthenticated:true,userId:"user_1",organizationId:"org_1",email:"owner@example.test",roles:["owner"]});io.member.mockResolvedValue({role:"owner",acceptedAt:new Date()});});
afterEach(()=>cleanup());
it("does not represent a failed member read as an empty organization or enable invitation",async()=>{
 io.members.mockRejectedValue(Error("unavailable"));render(await MembersPage({}));
 expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable");
 expect(screen.queryByText("No members recorded yet.")).toBeNull();
 expect(screen.queryByRole("button",{name:/invite/i})).toBeNull();
});
it("refuses to query organization members without a current role",async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,email:"viewer@example.test",organizationId:"org_1",roles:[]});render(await MembersPage({}));
 expect(screen.getByRole("alert").textContent).toContain("membership is required");
 expect(io.members).not.toHaveBeenCalled();
});
