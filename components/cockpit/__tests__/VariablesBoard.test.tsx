// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VariablesBoard } from "../VariablesBoard";

const board = (canEdit: boolean) => ({ ok: true, data: {
  canEdit,
  environments: [{ id: "dev", name: "Development", slug: "dev", tier: "development" }, { id: "prod", name: "Production", slug: "prod", tier: "production" }],
  variables: [{ key: "LOG_LEVEL", value: "info", scopeKey: "workspace", description: null, version: 1 }, { key: "LOG_LEVEL", value: "warn", scopeKey: "env:prod", description: null, version: 4 }, { key: "REPLICAS", value: "3", scopeKey: "env:prod", description: null, version: 1 }],
  resolved: [{ environmentId: "dev", digest: "a".repeat(64) }, { environmentId: "prod", digest: "b".repeat(64) }],
  gaps: [{ key: "REPLICAS", missingIn: ["dev"] }],
} });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("VariablesBoard", () => {
  it("shows overrides, inherited defaults and gaps, read-only for members", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(board(false))));
    render(<VariablesBoard />);
    await waitFor(() => expect(screen.getByText("Set only in some environments")).toBeTruthy());
    expect(screen.getByText("warn")).toBeTruthy();
    expect(screen.getByText("Inherits default")).toBeTruthy();
    expect(screen.getByText(/missing in Development/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Edit LOG_LEVEL/ })).toBeNull();
    expect(screen.getByText("Only workspace owners and admins can change variables.")).toBeTruthy();
  });
  it("edits with the version that was read and reloads on a conflict", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(board(true)))
      .mockResolvedValueOnce(json({ ok: false, error: "variable_changed" }, 409))
      .mockResolvedValueOnce(json(board(true)));
    vi.stubGlobal("fetch", f);
    render(<VariablesBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit LOG_LEVEL in Production" }));
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "error" } });
    fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    await waitFor(() => expect(screen.getByText(/changed or removed this variable/)).toBeTruthy());
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ key: "LOG_LEVEL", value: "error", environmentId: "prod", description: null, expectedVersion: 4 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("shows plain-language validation messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(board(true))).mockResolvedValueOnce(json({ ok: false, error: "variable_invalid", issues: ["looks_like_secret_key"] }, 422)));
    render(<VariablesBoard />);
    fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "github_token" } });
    fireEvent.click(screen.getByRole("button", { name: "Add variable" }));
    await waitFor(() => expect(screen.getByText(/Store secrets as scoped credentials/)).toBeTruthy());
  });
});
