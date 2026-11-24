import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ context: vi.fn(), release: vi.fn(), tickets: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mock.context }));
vi.mock("@/lib/db", () => ({
  prisma: { release: { findFirst: mock.release }, changeTicket: { findMany: mock.tickets } },
}));

import LinkedReleasePage from "../page";

const scope = { isAuthenticated: true, sessionUserId: "canonical", organizationId: "workspace-a", roles: ["read_only"] };
const render = async () => renderToStaticMarkup(await LinkedReleasePage({ params: Promise.resolve({ id: "release-a" }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mock.context.mockResolvedValue(scope);
  mock.release.mockResolvedValue({ id: "release-a", releaseTag: "v2.14.0", status: "ready", summary: "Sample release" });
  mock.tickets.mockResolvedValue([{ id: "ticket-a", externalKey: "CHG-2041", title: "Sample ticket" }]);
});

it("renders only the scoped release and its linked tickets", async () => {
  const markup = await render();
  expect(markup).toContain("v2.14.0");
  expect(markup).toContain("CHG-2041");
  expect(markup).not.toMatch(/<(button|form|a)\b/);
  expect(mock.release).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "release-a", organizationId: "workspace-a" } }));
  expect(mock.tickets).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "workspace-a", linkedReleaseIds: { has: "release-a" } }, take: 51 }));
});

it("withholds reads without current membership", async () => {
  mock.context.mockResolvedValue({ ...scope, roles: [] });
  expect(await render()).toContain("active workspace membership");
  expect(mock.release).not.toHaveBeenCalled();
});

it("withholds record content if workspace access changes while reading", async () => {
  mock.context.mockResolvedValueOnce(scope).mockResolvedValueOnce({ ...scope, organizationId: "workspace-b" });
  const markup = await render();
  expect(markup).toContain("Release unavailable");
  expect(markup).not.toContain("Sample");
});
