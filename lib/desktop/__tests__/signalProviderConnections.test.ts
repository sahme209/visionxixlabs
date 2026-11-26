/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
const m = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), del: vi.fn() }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { signalConnection: m.get, saveSignalConnection: m.save, disconnectSignalConnection: m.del } }));
import { SignalProviderConnections } from "../../../desktop/src/components/SignalProviderConnections";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("SignalProviderConnections", () => {
  it("shows every read-only provider and connects one, clearing secrets afterwards", async () => {
    m.get.mockImplementation(async (provider: string) => ({ ok: true, data: provider === "pagerduty" ? { provider, connected: true, status: "active", settings: { region: "eu" }, authority: "observation_only" } : { provider, connected: false, status: "not_connected", authority: "observation_only" } }));
    m.save.mockResolvedValue({ ok: true, data: { provider: "datadog", connected: true, status: "active", inventoryCount: 5, authority: "observation_only" } });
    render(createElement(SignalProviderConnections));
    for (const name of ["Argo CD", "Flux", "PagerDuty", "Opsgenie", "Sentry", "Datadog", "LaunchDarkly", "Unleash", "Jenkins"]) expect(screen.getByRole("article", { name })).toBeTruthy();
    await waitFor(() => expect(within(screen.getByRole("article", { name: "PagerDuty" })).getByText("Connected · read-only")).toBeTruthy());
    const card = within(screen.getByRole("article", { name: "Datadog" }));
    const connect = card.getByRole("button", { name: "Connect read-only" }) as HTMLButtonElement;
    expect(connect.disabled).toBe(true);
    fireEvent.change(card.getByLabelText("Site"), { target: { value: "datadoghq.eu" } });
    fireEvent.change(card.getByLabelText("Monitor tag"), { target: { value: " service:checkout " } });
    fireEvent.change(card.getByLabelText("API key"), { target: { value: "k1" } });
    fireEvent.change(card.getByLabelText("Application key (monitors_read)"), { target: { value: "k2" } });
    fireEvent.click(connect);
    await waitFor(() => expect(card.getByText("Connected. 5 found on the first read.")).toBeTruthy());
    expect(m.save).toHaveBeenCalledWith("datadog", { site: "datadoghq.eu", tag: "service:checkout", apiKey: "k1", appKey: "k2" });
    expect((card.getByLabelText("API key") as HTMLInputElement).value).toBe("");
    expect((card.getByLabelText("Monitor tag") as HTMLInputElement).value).toBe(" service:checkout ");
  });
});
