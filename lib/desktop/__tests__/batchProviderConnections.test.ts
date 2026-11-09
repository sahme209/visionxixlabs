/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const m = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), del: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { batchConnection: m.get, saveBatchConnection: m.save, disconnectBatchConnection: m.del } }));
import { BatchProviderConnections } from "../../../desktop/src/components/BatchProviderConnections";

beforeEach(() => {
  vi.resetAllMocks();
  m.get.mockImplementation(async (provider: string) => ({ ok: true, data: { provider, connected: false, status: "not_connected", authority: "observation_only" } }));
});
afterEach(cleanup);
const card = (name: string) => screen.getByRole("article", { name });

describe("Batch provider connections", () => {
  it("states the read-only boundary and shows all three providers", async () => {
    render(createElement(BatchProviderConnections));
    expect(screen.getByText(/cannot start, retry or cancel anything/)).toBeTruthy();
    for (const name of ["Prefect", "Dagster", "Argo Workflows"]) expect(card(name)).toBeTruthy();
    await vi.waitFor(() => expect(m.get).toHaveBeenCalledTimes(3), { timeout: 5000 });
  });

  it("only enables connect for an https URL and a token, then clears the token", async () => {
    m.save.mockResolvedValue({ ok: true, data: { provider: "prefect", connected: true, status: "active", inventoryCount: 4, authority: "observation_only" } });
    render(createElement(BatchProviderConnections));
    const c = within(card("Prefect"));
    const button = c.getByRole("button", { name: "Connect read-only" }) as HTMLButtonElement;
    fireEvent.change(c.getByLabelText("API URL"), { target: { value: "http://insecure.example" } });
    fireEvent.change(c.getByLabelText("API key"), { target: { value: "pk_secret" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(c.getByLabelText("API URL"), { target: { value: "https://api.prefect.cloud/api" } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await c.findByText(/Connected\. 4 found/);
    expect(m.save).toHaveBeenCalledWith("prefect", { baseUrl: "https://api.prefect.cloud/api", token: "pk_secret" });
    expect((c.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect(await c.findByText("Connected · read-only")).toBeTruthy();
  });

  it("requires a valid namespace for Argo Workflows", async () => {
    render(createElement(BatchProviderConnections));
    const c = within(card("Argo Workflows"));
    fireEvent.change(c.getByLabelText("API URL"), { target: { value: "https://argo.example.com" } });
    fireEvent.change(c.getByLabelText("Argo token"), { target: { value: "t" } });
    const button = c.getByRole("button", { name: "Connect read-only" }) as HTMLButtonElement;
    fireEvent.change(c.getByLabelText("Namespace"), { target: { value: "Bad_NS" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(c.getByLabelText("Namespace"), { target: { value: "batch" } });
    expect(button.disabled).toBe(false);
  });

  it("shows a server error code without claiming a connection", async () => {
    m.save.mockResolvedValue({ ok: false, error: "dagster_api_failed" });
    render(createElement(BatchProviderConnections));
    const c = within(card("Dagster"));
    fireEvent.change(c.getByLabelText("API URL"), { target: { value: "https://acme.dagster.cloud/prod" } });
    fireEvent.change(c.getByLabelText("User token"), { target: { value: "t" } });
    fireEvent.click(c.getByRole("button", { name: "Connect read-only" }));
    await c.findByText("Could not connect (dagster_api_failed).");
    expect(c.getByText("Not connected")).toBeTruthy();
  });
});
