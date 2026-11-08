import { beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ membership: vi.fn(), run: vi.fn(), account: vi.fn(), enqueue: vi.fn(), tasks: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {
  orgMembership: { findUnique: db.membership },
  user: { findUnique: async () => ({ plan: "enterprise" }) },
  axiomAgentRun: { findUnique: db.run },
  cloudAccount: { findUnique: db.account },
  axiomAgentTask: { findMany: db.tasks },
} }));
vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { id: "user_a" } }) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/entitlements", () => ({ getEntitlementsFromPlan: () => ({ axiomExecution: true }) }));
vi.mock("@/lib/axiom/taskQueue/runner", () => ({ enqueueTasks: db.enqueue, processQueue: vi.fn() }));

import { GET, POST } from "@/app/api/axiom/tasks/route";

const admin = { role: "owner", acceptedAt: new Date() };
const body = { agentRunId: "run_a", provider: "aws", organizationId: "org_a", cloudAccountId: "acct_a", taskTypes: ["apply_action"] };
const post = (b: unknown) => POST({ json: async () => b } as never);

beforeEach(() => {
  vi.clearAllMocks();
  db.membership.mockResolvedValue(admin);
  db.run.mockResolvedValue({ organizationId: "org_a", cloudAccountId: "acct_a" });
  db.account.mockResolvedValue({ organizationId: "org_a" });
  db.enqueue.mockResolvedValue(["task_1"]);
  db.tasks.mockResolvedValue([]);
});

it("queues tasks when the caller is an admin and the run and account belong to the workspace", async () => {
  expect((await post(body)).status).toBe(200);
  expect(db.enqueue).toHaveBeenCalledOnce();
});

it("refuses apply work in a workspace the caller doesn't administer", async () => {
  db.membership.mockResolvedValue({ role: "read_only", acceptedAt: new Date() });
  expect((await post(body)).status).toBe(403);
  db.membership.mockResolvedValue(null);
  expect((await post(body)).status).toBe(403);
  expect(db.enqueue).not.toHaveBeenCalled();
});

it("refuses another workspace's run or cloud account", async () => {
  db.run.mockResolvedValue({ organizationId: "org_other", cloudAccountId: "acct_a" });
  expect((await post(body)).status).toBe(404);
  db.run.mockResolvedValue({ organizationId: "org_a", cloudAccountId: "acct_a" });
  db.account.mockResolvedValue({ organizationId: "org_other" });
  expect((await post(body)).status).toBe(404);
  expect(db.enqueue).not.toHaveBeenCalled();
});

it("lists a run's tasks only for members of the run's own workspace", async () => {
  const get = () => GET({ nextUrl: new URL("https://x.test/api/axiom/tasks?runId=run_a") } as never);
  db.membership.mockResolvedValue(null);
  expect((await get()).status).toBe(404);
  expect(db.tasks).not.toHaveBeenCalled();
  db.membership.mockResolvedValue({ role: "read_only", acceptedAt: new Date() });
  expect((await get()).status).toBe(200);
});
