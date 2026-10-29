import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.context }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import Overview from "../page";
it("routes authenticated revoked selections to workspace recovery before tenant reads", async () => {
 m.context.mockResolvedValue({ isAuthenticated: true, email: "member@example.test", roles: [] });
 await expect(Overview()).rejects.toThrow("REDIRECT:/control/workspaces");
});
it("preserves sign-in for an unauthenticated request", async () => {
 m.context.mockResolvedValue({ isAuthenticated: false, roles: [] });
 await expect(Overview()).rejects.toThrow("REDIRECT:/auth/signin");
});
