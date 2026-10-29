import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ context: vi.fn(), memberships: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.context }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findMany: m.memberships } } }));
vi.mock("@/components/cockpit/CockpitShell", () => ({ CockpitShell: ({ children }: { children: import("react").ReactNode }) => createElement("section", null, children) }));
import ControlLayout from "../layout";
beforeEach(() => { m.memberships.mockResolvedValue([{ organizationId: "personal", role: "owner" }]); });
it("renders only recovery controls when selected membership is revoked rather than invoking tenant children", async () => {
 m.context.mockResolvedValue({ isAuthenticated: true, sessionUserId: "member", userId: "member", email: "member@example.test", roles: [] });
 const element = await ControlLayout({ children: "TENANT_CONTENT_MUST_NOT_RENDER" });
 const html = renderToStaticMarkup(element);
 expect(html).not.toContain("TENANT_CONTENT_MUST_NOT_RENDER");
 expect(html).toContain("Choose an available workspace");
 expect(element.props.workspaceOptions).toEqual([{ id: "personal", label: expect.any(String), role: "owner" }]);
});
it("preserves tenant content for a currently verified membership", async () => {
 m.context.mockResolvedValue({ isAuthenticated: true, sessionUserId: "member", userId: "member", organizationId: "personal", email: "member@example.test", roles: ["owner"] });
 expect(renderToStaticMarkup(await ControlLayout({ children: "VERIFIED_TENANT_CONTENT" }))).toContain("VERIFIED_TENANT_CONTENT");
});
