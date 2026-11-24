/** @vitest-environment jsdom */
import {createElement} from "react";
import {act, cleanup, render, screen} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";

const router = vi.hoisted(() => ({id: "fixture-release"}));
vi.mock("next/navigation", () => ({useParams: () => ({id: router.id}), useSearchParams: () => new URLSearchParams()}));
vi.mock("next/link", () => ({
  default: ({href, children}: {href: string; children: React.ReactNode}) => createElement("a", {href}, children),
}));
import ReleaseOverviewPage from "../releases/[id]/page";

afterEach(() => {
  cleanup();
  router.id = "fixture-release";
  vi.unstubAllGlobals();
});

it("clears the old release while verifying the next destination", async () => {
  const details = {ok:true, data:{release:{id:"fixture-release", releaseTag:"v2.14.0", status:"ready", applicationId:"fixture-application",
    createdAtIso:"2026-11-17T12:00:00Z"},
    repository:null, readiness:null, cherryPicks:{total:0,byStatus:{},recent:[]},
    policyViolations:{total:0,blockingOpen:0,byStatus:{},recent:[]},
    changeTickets:{total:0,byProvider:{},items:[]}, evidencePack:null}};
  let finish!: (response: Response) => void;
  const nextResponse = new Promise<Response>(resolve => { finish = resolve; });
  const firstPath = "/api/dashboard/release-detail/fixture-release";
  const fetcher = vi.fn((url: string, _options: RequestInit) => {
    if (url === firstPath) return Promise.resolve(Response.json(details));
    if (url.startsWith("/api/dashboard/release-activity/")) return Promise.resolve(Response.json({ok: true, data: {events: []}}));
    return nextResponse.then(response => response.clone());
  });
  vi.stubGlobal("fetch", fetcher);
  const view = render(createElement(ReleaseOverviewPage));
  await screen.findByRole("heading", {name: "v2.14.0"});
  const firstOptions = fetcher.mock.calls.filter(([url]) => url === firstPath).at(-1)![1];
  const signal = firstOptions.signal as AbortSignal;
  expect(firstOptions).toMatchObject({cache: "no-store"});

  router.id = "different-release";
  view.rerender(createElement(ReleaseOverviewPage));
  expect(screen.queryByRole("heading", {name: "v2.14.0"})).toBeNull();
  expect(screen.getByText("Loading release overview…")).toBeTruthy();
  expect(signal.aborted).toBe(true);
  await act(async () => finish(Response.json(details)));
  expect(screen.getByRole("alert").textContent).toContain("Release details could not be verified.");
  expect(screen.queryByRole("heading", {name: "v2.14.0"})).toBeNull();
});
