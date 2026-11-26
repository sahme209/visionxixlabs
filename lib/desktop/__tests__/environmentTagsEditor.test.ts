/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const m = vi.hoisted(() => ({ setTags: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", async (orig) => {
  const actual = await orig<typeof import("../../../desktop/src/lib/desktopClient")>();
  return { ...actual, desktopClient: Object.assign(Object.create(Object.getPrototypeOf(actual.desktopClient)), actual.desktopClient, { setEnvironmentTags: m.setTags }) };
});
import { EnvironmentTagsEditor, FanOutPreview } from "../../../desktop/src/views/SettingsView";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const env = { id: "e1", slug: "acme-eu", name: "Acme EU", tier: "prod", displayOrder: 1, hasApprovalPolicy: false, tags: ["ring:0"] };
describe("EnvironmentTagsEditor", () => {
  it("saves normalized tags with the tags it read, and blocks invalid ones", async () => {
    m.setTags.mockResolvedValue({ ok: true, data: { id: "e1", tags: ["ring:1", "tenant:acme"] } });
    const onSaved = vi.fn();
    render(createElement(EnvironmentTagsEditor, { environment: env, onSaved }));
    const input = screen.getByLabelText(/Tags/);
    fireEvent.change(input, { target: { value: "bad" } });
    expect((screen.getByRole("button", { name: "Save tags" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Tenant:Acme ring:1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save tags" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(m.setTags).toHaveBeenCalledWith("e1", ["ring:1", "tenant:acme"], ["ring:0"]);
  });
  it("explains a concurrent change", async () => {
    m.setTags.mockResolvedValue({ ok: false, error: "tags_changed" });
    render(createElement(EnvironmentTagsEditor, { environment: env, onSaved: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "Save tags" }));
    await waitFor(() => expect(screen.getByText(/Someone changed these tags/)).toBeTruthy());
  });
});
describe("FanOutPreview", () => {
  it("shows matching environments in ring order", () => {
    render(createElement(FanOutPreview, { environments: [env, { ...env, id: "e2", name: "Beta EU", tags: ["tenant:beta", "ring:1"] }, { ...env, id: "e3", name: "Acme", tags: ["tenant:acme", "ring:0"] }] }));
    expect(screen.getByText("Ring 0:").parentElement?.textContent).toBe("Ring 0: Acme");
    expect(screen.getByText("Ring 1:").parentElement?.textContent).toBe("Ring 1: Beta EU");
  });
});
