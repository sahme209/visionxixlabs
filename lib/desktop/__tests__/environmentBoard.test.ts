import { expect, it } from "vitest";
import { buildEnvironmentBoard } from "../environmentBoard";
const env = (id: string, name: string, displayOrder: number) => ({ id, name, tier: name, displayOrder });
const run = (id: string, environmentId: string, repo: string, createdAt: string, sha = "abcdef123456", conclusion: string | null = "success") =>
  ({ id, environmentId, repositoryFullName: repo, sourceRef: "main", sourceCommitSha: sha, status: "completed", conclusion, createdAt, completedAt: createdAt });
it("orders environments by display order and keeps the latest run per repository and environment", () => {
  const board = buildEnvironmentBoard([env("p", "production", 3), env("s", "staging", 1)], [
    run("1", "s", "org/api", "2026-11-20T10:00:00Z", "1111111aaaa"),
    run("2", "s", "org/api", "2026-11-21T10:00:00Z", "2222222bbbb"),
    run("3", "p", "org/api", "2026-11-19T10:00:00Z", "1111111aaaa", "failure"),
    run("4", "s", "org/web", "2026-11-22T10:00:00Z"),
    run("5", "gone", "org/api", "2026-11-22T10:00:00Z"),
  ]);
  expect(board.environments.map((e) => e.name)).toEqual(["staging", "production"]);
  expect(board.rows.map((r) => r.repository)).toEqual(["org/api", "org/web"]);
  expect(board.rows[0].cells.map((c) => c?.commit)).toEqual(["2222222", "1111111"]);
  expect(board.rows[0].cells[1]?.conclusion).toBe("failure");
  expect(board.rows[1].cells[1]).toBeNull();
  expect(board.unplaced).toBe(1);
});
