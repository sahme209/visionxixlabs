// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SITE_URL } from "@/lib/seo";
import ChangelogPage from "../(marketing)/changelog/page";
import sitemap from "../sitemap";
import { CHANGELOG } from "@/lib/marketing/changelog";
afterEach(cleanup);

it("lists every entry under its date, newest first, with a guide link", () => {
  render(createElement(ChangelogPage));
  expect(screen.getByRole("heading", { level: 1, name: "What's new in V19" })).toBeTruthy();
  for (const e of CHANGELOG) expect(screen.getByRole("heading", { level: 2, name: e.title })).toBeTruthy();
  const times = screen.getAllByRole("listitem").map((li) => li.querySelector("time")?.getAttribute("dateTime")).filter(Boolean);
  expect(times).toEqual([...times].sort().reverse());
});

it("keeps entries dated, linked and specific", () => {
  for (const e of CHANGELOG) {
    expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(e.href.startsWith("/")).toBe(true);
    expect(e.items.length).toBeGreaterThan(0);
  }
});

it("indexes the changelog and the installer guide", () => {
  const urls = sitemap().map((entry) => entry.url);
  expect(urls).toContain(`${SITE_URL}/changelog`);
  expect(urls).toContain(`${SITE_URL}/docs/desktop-install`);
});
