// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import AdminLeadsPage from "../page";

vi.mock("@/components/motion/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/motion/Stagger", () => ({ Stagger: ({ children }: { children: ReactNode }) => children }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("reuses the same request after a lost response and page reload, then uses a fresh request", async () => {
  const lead = {
    id: "lead-sample", email: "sample@example.test", name: "Sample",
    status: "package_ready", source: "website-request", fullPayload: {},
    createdAt: "2026-11-24T00:00:00.000Z", updatedAt: "2026-11-24T00:00:00.000Z",
    generationRevision: "a".repeat(64),
  };
  let currentLead = lead;
  const requests: Array<{ key: string | null; revision: string | null }> = [];
  const alert = vi.fn();
  vi.stubGlobal("alert", alert);
  vi.stubGlobal("fetch", vi.fn(async (input: string, options?: RequestInit) => {
    if (input.startsWith("/api/leads/list")) return Response.json({ leads: [currentLead] });
    expect(input).toBe("/api/leads/lead-sample/generate");
    const headers = new Headers(options?.headers);
    const key = headers.get("idempotency-key");
    requests.push({ key, revision: headers.get("x-v19-lead-revision") });
    currentLead = { ...lead, generationRevision: "b".repeat(64) };
    if (requests.length === 1) throw new Error("connection lost");
    return Response.json({ success: true, requestId: key, status: "package_ready" });
  }));
  const first = render(createElement(AdminLeadsPage));
  fireEvent.click(await screen.findByRole("button", { name: "Regenerate package" }));
  await waitFor(() => expect(alert).toHaveBeenCalledOnce());
  first.unmount();

  render(createElement(AdminLeadsPage));
  fireEvent.click(await screen.findByRole("button", { name: "Regenerate package" }));
  await waitFor(() => expect(sessionStorage.getItem("v19:lead-generation:lead-sample")).toBeNull());
  expect(requests[0]?.key).toMatch(/^[a-f0-9-]{36}$/);
  expect(requests[1]).toEqual(requests[0]);

  await waitFor(() => expect((screen.getByRole("button", { name: "Regenerate package" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Regenerate package" }));
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(requests[2]?.revision).toBe("b".repeat(64));
  expect(requests[2]?.key).not.toBe(requests[0]?.key);
  await waitFor(() => expect(sessionStorage.getItem("v19:lead-generation:lead-sample")).toBeNull());
});
