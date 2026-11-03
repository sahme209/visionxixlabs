/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IntegrationCatalogBrowser } from "../IntegrationCatalogBrowser";
import { publicCatalogEntries } from "@/lib/integrations/publicIntegrationCatalog";
vi.mock("next/link", () => ({ default: ({ children, href, prefetch: _prefetch, ...props }: {children: React.ReactNode;href:string;prefetch?:boolean}) => createElement("a", { ...props, href }, children) }));
afterEach(cleanup);
it("starts with planned entries visible and never offers a public connection action", () => {
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const gitlab=screen.getByRole("article",{name:"GitLab integration"});
 expect(within(gitlab).getByText("Planned")).toBeDefined();
 expect(within(gitlab).queryByRole("link")).toBeNull();
 expect(within(gitlab).getByText("No setup available yet")).toBeDefined();
 for(const link of screen.getAllByRole("link"))expect(link.getAttribute("href")).not.toMatch(/^\/(?:api\/|account\/integrations)|^https?:/i);
 expect(screen.getByText(/not your account’s connection or permission status/i)).toBeDefined();
});
it("combines job, availability and operation filters without changing access",()=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 fireEvent.change(screen.getByLabelText("Job"),{target:{value:"cloud"}});
 fireEvent.change(screen.getByLabelText("Availability"),{target:{value:"preview"}});
 fireEvent.change(screen.getByLabelText("Operation model"),{target:{value:"read"}});
 expect(screen.getByRole("article",{name:"Azure integration"})).toBeDefined();
 expect(screen.getByRole("article",{name:"GCP integration"})).toBeDefined();
 expect(screen.queryByRole("article",{name:"AWS integration"})).toBeNull();
 expect(screen.queryByRole("article",{name:"GitHub integration"})).toBeNull();
 expect(screen.getByRole("status").textContent).toMatch(/^2 connectors shown/);
});
it("searches names, explains empty intersections and resets all filters",()=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 fireEvent.change(screen.getByLabelText("Search connectors"),{target:{value:"  GitLab  "}});
 expect(screen.getAllByRole("article")).toHaveLength(1);
 fireEvent.change(screen.getByLabelText("Availability"),{target:{value:"available"}});
 expect(screen.getByRole("heading",{name:"No connectors match these filters"})).toBeDefined();
 fireEvent.click(screen.getByRole("button",{name:"Clear filters"}));
 expect(screen.getAllByRole("article")).toHaveLength(publicCatalogEntries().length);
 expect((screen.getByLabelText("Search connectors")as HTMLInputElement).value).toBe("");
 expect((screen.getByLabelText("Job")as HTMLSelectElement).value).toBe("all");
});
it("keeps setup links as ordinary documentation navigation",()=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const aws=screen.getByRole("article",{name:"AWS integration"});
 expect(within(aws).getByRole("link",{name:"Read setup guide"}).getAttribute("href")).toBe("/docs/aws-setup");
});
