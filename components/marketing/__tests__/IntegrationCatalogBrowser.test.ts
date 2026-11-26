/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { IntegrationCatalogBrowser } from "../IntegrationCatalogBrowser";
import { publicCatalogEntries } from "@/lib/integrations/publicIntegrationCatalog";
vi.mock("next/link", () => ({ default: ({ children, href, prefetch: _prefetch, ...props }: {children: React.ReactNode;href:string;prefetch?:boolean}) => createElement("a", { ...props, href }, children) }));
afterEach(cleanup);
it("shows gated GitLab documentation without offering a public connection action", () => {
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const gitlab=screen.getByRole("article",{name:"GitLab integration"});
 expect(within(gitlab).getByText("Implementation review")).toBeDefined();
 expect(within(gitlab).getByRole("link", {name: "Read implementation notes for GitLab"}).getAttribute("href")).toBe("/docs/integration-setup#gitlab");
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
 expect(within(aws).getByRole("link",{name:"Read setup guide for AWS"}).getAttribute("href")).toBe("/docs/aws-setup");
});
it("shows each card's typed operation models separately from availability",()=>{
 const entries=publicCatalogEntries();
 render(createElement(IntegrationCatalogBrowser,{entries}));
 const github=screen.getByRole("article",{name:"GitHub integration"});
 const models=within(github).getByRole("group",{name:"Operation models"});
 expect(within(models).getByText("Read context")).toBeDefined();
 expect(within(models).getByText("Change workflows")).toBeDefined();
 expect(within(models).queryByText("Receive events")).toBeNull();
 const grafana=screen.getByRole("article",{name:"Grafana integration"});
 expect(within(within(grafana).getByRole("group",{name:"Operation models"})).getByText("Receive events")).toBeDefined();
 expect(within(models).queryByText(/connected|available|enabled/i)).toBeNull();
 expect(screen.getByText(/not your account’s connection or permission status/i)).toBeDefined();
});
it("lists GitLab under reviewed reads and excludes it from workflow changes",()=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const gitlab=screen.getByRole("article",{name:"GitLab integration"});
 const models=within(gitlab).getByRole("group",{name:"Operation models"});
 expect(within(models).getByText("Read context")).toBeDefined();
 expect(within(models).queryByText("Change workflows")).toBeNull();
 expect(within(gitlab).getByText("Implementation review")).toBeDefined();
 expect(within(gitlab).getByRole("link", {name: "Read implementation notes for GitLab"}).getAttribute("href")).toBe("/docs/integration-setup#gitlab");
 expect(within(gitlab).queryByRole("button")).toBeNull();
 fireEvent.change(screen.getByLabelText("Search connectors"),{target:{value:"GitLab"}});
 fireEvent.change(screen.getByLabelText("Operation model"),{target:{value:"change"}});
 expect(screen.queryByRole("article",{name:"GitLab integration"})).toBeNull();
 fireEvent.change(screen.getByLabelText("Operation model"),{target:{value:"read"}});
 expect(screen.getByRole("article",{name:"GitLab integration"})).toBeDefined();
});
it.each(['GitLab','no connector has this name'])('returns deliberate clear focus to search after filtering %s',query=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const search=screen.getByLabelText('Search connectors');
 fireEvent.change(search,{target:{value:query}});
 const clear=screen.getByRole('button',{name:'Clear filters'});
 clear.focus();expect(document.activeElement).toBe(clear);
 fireEvent.click(clear);
 expect(screen.queryByRole('button',{name:'Clear filters'})).toBeNull();
 expect(document.activeElement).toBe(search);
 expect((search as HTMLInputElement).value).toBe('');
 expect(screen.getAllByRole('article')).toHaveLength(publicCatalogEntries().length);
});
it('does not autofocus at mount or steal focus during ordinary filter changes',()=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const search=screen.getByLabelText('Search connectors');expect(document.activeElement).not.toBe(search);
 search.focus();fireEvent.change(search,{target:{value:'Git'}});expect(document.activeElement).toBe(search);
 const job=screen.getByLabelText('Job');job.focus();fireEvent.change(job,{target:{value:'cloud'}});expect(document.activeElement).toBe(job);
});

it('shows real catalog marks and keeps detailed limitations available through native disclosures',()=>{
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 for(const entry of publicCatalogEntries()){
  const card=screen.getByRole('article',{name:`${entry.name} integration`});
  if(entry.id==='vscode')expect(card.querySelector('[data-logo-kind="generic-editor"]')).not.toBeNull();
  else if(entry.id==='flux')expect(card.querySelector('[data-logo-kind="generic-gitops"]')).not.toBeNull();
  else if(entry.id==='sentry'||entry.id==='datadog')expect(card.querySelector('[data-logo-kind="generic-monitoring"]')).not.toBeNull();
  else if(entry.id==='opsgenie')expect(card.querySelector('[data-logo-kind="generic-alerts"]')).not.toBeNull();
  else if(entry.id==='launchdarkly')expect(card.querySelector('[data-logo-kind="generic-flags"]')).not.toBeNull();
  else expect(card.querySelector('img')?.getAttribute('src')).toMatch(/^\/(?:logos\/integrations|brands)\//);
  const disclosure=card.querySelector('details');expect(disclosure).not.toBeNull();expect(disclosure?.open).toBe(false);
  expect(disclosure?.textContent).toContain(entry.availability.detail);
  fireEvent.click(within(card).getByText('Connection details'));expect(disclosure?.open).toBe(true);
  if(!entry.availability.enabled)expect(within(card).queryByRole('link')).toBeNull();
 }
});

it.each([
 ["GitHub", "Read setup guide", "/docs/integration-setup#github"],
 ["Apache Airflow", "Read setup guide", "/docs/integration-setup#airflow"],
 ["Azure", "Read preview scope", "/docs/azure-setup"],
 ["GCP", "Read preview scope", "/docs/gcp-setup"],
 ["Slack", "Read implementation notes", "/docs/integration-setup#slack"],
])("routes %s to the relevant guide without starting a connection", (provider, label, href) => {
 render(createElement(IntegrationCatalogBrowser,{entries:publicCatalogEntries()}));
 const card = within(screen.getByRole("article",{name:`${provider} integration`}));
 expect(card.getByRole("link",{name:`${label} for ${provider}`}).getAttribute("href")).toBe(href);
 expect(card.getByText("Connection details").getAttribute("aria-label")).toBe(`Connection details for ${provider}`);
});
