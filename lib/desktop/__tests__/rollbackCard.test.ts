/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
import { RollbackCard } from "../../../desktop/src/views/SettingsView";
import type { RollbackTarget } from "../../../lib/releaseops/rollbackTarget";

afterEach(cleanup);
const dep = (over: Record<string, unknown>) => ({ id: "a", environmentId: "prod", repositoryFullName: "acme/web", sourceRef: "v1.4.0", sourceKind: "tag", sourceCommitSha: "a".repeat(40), status: "completed", conclusion: "success", createdAt: "2026-11-20T10:00:00Z", ...over });
const target = (over: Record<string, unknown> = {}): RollbackTarget => ({ kind: "target", from: dep({ id: "b", sourceCommitSha: "b".repeat(40) }), to: dep(over), pinned: true, note: "Redeploys tag v1.4.0 (aaaaaaa), which last deployed successfully here." });

describe("RollbackCard", () => {
  it("prepares a rollback with the last good tag and confirms the resolved commit", () => {
    const onPrepare = vi.fn();
    const { rerender } = render(createElement(RollbackCard, { target: target(), resolvedCommit: null, active: false, onPrepare }));
    expect(screen.getByText(/Last good version here:/).textContent).toContain("aaaaaaaaaaaa from tag v1.4.0");
    fireEvent.click(screen.getByRole("button", { name: "Prepare rollback to this version" }));
    expect(onPrepare).toHaveBeenCalledWith("v1.4.0", "tag");
    rerender(createElement(RollbackCard, { target: target(), resolvedCommit: null, active: true, onPrepare }));
    expect(screen.getByText(/Check readiness to confirm the commit/)).toBeTruthy();
    rerender(createElement(RollbackCard, { target: target(), resolvedCommit: "a".repeat(40), active: true, onPrepare }));
    expect(screen.getByText(/redeploys the last good version/)).toBeTruthy();
  });
  it("warns when a branch has moved since the last good deployment", () => {
    render(createElement(RollbackCard, { target: target({ sourceKind: "branch", sourceRef: "release" }), resolvedCommit: "c".repeat(40), active: true, onPrepare: vi.fn() }));
    expect(screen.getByText(/the branch has moved/)).toBeTruthy();
  });
  it("says when there is nothing to roll back to", () => {
    render(createElement(RollbackCard, { target: { kind: "none", reason: "no_earlier_success" }, resolvedCommit: null, active: false, onPrepare: vi.fn() }));
    expect(screen.getByText(/nothing to roll back to/)).toBeTruthy();
  });
});
