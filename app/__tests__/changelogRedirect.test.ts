import { expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/seo";
import ChangelogPage from "../(marketing)/changelog/page";
import sitemap from "../sitemap";

const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => navigation);

it("sends the old changelog address to desktop release guidance", () => {
  ChangelogPage();
  expect(navigation.redirect).toHaveBeenCalledWith("/docs/desktop-install#updates");
});

it("indexes the installer guide at its canonical address", () => {
  const urls = sitemap().map(entry => entry.url);
  expect(urls).toContain(`${SITE_URL}/docs/desktop-install`);
  expect(urls).not.toContain(`${SITE_URL}/changelog`);
});
