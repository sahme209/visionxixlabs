// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { McpRegistryBrowser } from "../McpRegistryBrowser";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const server = (name: string, over = {}) => ({ name, title: name.split("/")[1], description: "Does things", version: "1.0.0", websiteUrl: null, repositoryUrl: "https://github.com/example/x", connections: ["remote"], remoteHosts: ["mcp.example.io"], packageTypes: [], status: "active", ...over });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("McpRegistryBrowser", () => {
  it("lists servers, searches and loads more pages", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ ok: true, data: { servers: [server("io.example/one")], nextCursor: "c1" } }))
      .mockResolvedValueOnce(json({ ok: true, data: { servers: [server("io.example/two", { connections: ["local_package"], remoteHosts: [], packageTypes: ["npm"] })], nextCursor: null } }))
      .mockResolvedValueOnce(json({ ok: true, data: { servers: [server("io.example/pg")], nextCursor: null } }));
    vi.stubGlobal("fetch", f);
    render(createElement(McpRegistryBrowser));
    expect(await screen.findByText("one")).toBeTruthy();
    expect(screen.getByText("Hosted at mcp.example.io")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Runs locally (npm)")).toBeTruthy();
    expect(f.mock.calls[1][0]).toContain("cursor=c1");
    fireEvent.change(screen.getByLabelText("Search MCP servers"), { target: { value: "postgres" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("pg")).toBeTruthy();
    expect(screen.queryByText("one")).toBeNull();
    expect(f.mock.calls[2][0]).toContain("search=postgres");
    expect(screen.getByRole("link", { name: "Publisher page" }).getAttribute("rel")).toContain("noopener");
  });
  it("says when the registry is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ ok: false }, 503)));
    render(createElement(McpRegistryBrowser));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
