/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/docs/permissions-model" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
import fs from "node:fs";
import path from "node:path";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsContents } from "@/components/docs/DocsContents";
beforeEach(() => { route.path = "/docs/permissions-model"; vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("filters existing guide titles with trimmed case-insensitive text and retains ordinary destinations", () => {
  render(createElement(DocsSidebar));
  const field = screen.getByRole("searchbox", { name: "Find a guide" });
  expect(document.activeElement).not.toBe(field);
  expect(screen.getByText(/Filters guide titles, section names, summaries and headings/)).toBeDefined();
  fireEvent.change(field, { target: { value: "  pErMiSsIoNs  " } });
  const nav = screen.getByRole("navigation", { name: "Documentation navigation" });
  expect(within(nav).getAllByRole("link").map(link=>link.getAttribute("href"))).toEqual(["/docs/quickstart-checklist", "/docs/security-model", "/docs/permissions-model"]);
  const link = within(nav).getByRole("link", { name: "Permissions model", current: "page" });
  expect(link.getAttribute("href")).toBe("/docs/permissions-model");
  expect(link.className).toContain("bg-orange-500/10");
  expect(screen.getByText("Trust & security")).toBeDefined();
  expect(screen.queryByText("Configure delivery")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("3 guides shown");
});
it("matches existing section names while keeping their guide groups", () => {
  render(createElement(DocsSidebar));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a guide" }), { target: { value: "desktop" } });
  expect(screen.getByText("Desktop")).toBeDefined();
  expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(expect.arrayContaining(["/docs/desktop-install", "/docs/integration-setup"]));
  expect(screen.getByRole("status").textContent).toBe(`${screen.getAllByRole("link").length} guides shown`);
});
it("reports an empty title match, then clears the filter and returns focus to its field", () => {
  render(createElement(DocsSidebar));
  const field = screen.getByRole("searchbox", { name: "Find a guide" });
  fireEvent.change(field, { target: { value: "not-a-published-guide-xyz" } });
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.getByRole("status").textContent).toBe("No guides match.");
  const clear = screen.getByRole("button", { name: "Clear guide filter" });
  clear.focus(); fireEvent.click(clear);
  expect((field as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(field);
  expect(screen.getAllByRole("link")).toHaveLength(28);
  expect(screen.getByRole("status").textContent).toBe("28 guides shown");
  expect(screen.queryByRole("button", { name: "Clear guide filter" })).toBeNull();
});
it("retains mobile Escape and route-change close behavior while filtering", () => {
  const view = render(createElement(DocsContents));
  const toggle = screen.getByRole("button", { name: "Documentation contents" });
  fireEvent.click(toggle);
  const field = screen.getByRole("searchbox", { name: "Find a guide" });
  fireEvent.change(field, { target: { value: "Permissions" } }); field.focus();
  fireEvent.keyDown(field, { key: "Escape" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  const link = screen.getByRole("link", { name: "Permissions model" }); link.focus();
  route.path = "/docs/security-model"; view.rerender(createElement(DocsContents));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(toggle);
});

it("lists every authored public guide once without adding legacy redirect aliases",()=>{
 const aliases=new Set(["/docs/architecture","/docs/desktop-architecture","/docs/best-practices","/docs/terraform-export","/docs/scanning"]);
 const docsRoot=path.resolve(process.cwd(),"app/docs");
 const pages=fs.readdirSync(docsRoot,{recursive:true}).filter((file):file is string=>typeof file==="string" && (file==="page.tsx" || file.endsWith("/page.tsx")));
 const authored=pages.map(file=>"/docs"+(file==="page.tsx"?"":"/"+file.slice(0,-9))).filter(route=>!aliases.has(route)).sort();
 render(createElement(DocsSidebar));const hrefs=screen.getAllByRole("link").map(link=>link.getAttribute("href")!).sort();
 expect(hrefs).toEqual(authored);expect(new Set(hrefs).size).toBe(hrefs.length);
 for(const alias of aliases)expect(fs.readFileSync(path.join(docsRoot,alias.slice(6),"page.tsx"),"utf8")).toContain("redirect(");
});
it.each([["Source modes","/docs/source-modes"],["OAuth setup","/docs/oauth-setup"],["Execution plans","/docs/execution-plans"],["Audit evidence","/docs/audit-logs"],["Product surfaces","/docs/surfaces"]])("finds existing omitted guide %s",(label,href)=>{
 render(createElement(DocsSidebar));fireEvent.change(screen.getByRole("searchbox",{name:"Find a guide"}),{target:{value:label}});
 expect(screen.getByRole("link",{name:label}).getAttribute("href")).toBe(href);
});

it.each([["System requirements","/docs/desktop-install"],["Separate decisions from effects","/docs/audit-logs"],["Local files on your computer","/docs/source-modes"]])("finds a public guide by authored task heading %s",(query,href)=>{
 render(createElement(DocsSidebar));fireEvent.change(screen.getByRole("searchbox",{name:"Find a guide"}),{target:{value:query}});
 expect(screen.getAllByRole("link").map(link=>link.getAttribute("href"))).toContain(href);
});

it("requires every query word without evaluating or storing the query",()=>{
 render(createElement(DocsSidebar));const field=screen.getByRole("searchbox",{name:"Find a guide"});
 fireEvent.change(field,{target:{value:"REQUIREMENTS   System"}});expect(screen.getAllByRole("link").map(link=>link.getAttribute("href"))).toContain("/docs/desktop-install");
 fireEvent.change(field,{target:{value:"System requirements nonexistent-query-word"}});expect(screen.queryAllByRole("link")).toHaveLength(0);
 expect(window.location.search).toBe("");
});
