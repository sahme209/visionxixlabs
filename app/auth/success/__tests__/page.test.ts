import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
import Page from "../page";
it.each(["consent_recorded", "declined", "exchange_failed", "record_failed", "unavailable", "invalid_state", "authorization_required", "connection_exists"])("forwards Jira %s to connection return", async status => {
  await expect(Page({ searchParams: Promise.resolve({ integration: "jira", status }) })).rejects.toThrow(`/control/connection-return?integration=jira&status=${status}`);
});
it.each(["github", "slack", "teams", "linear"])("preserves %s forwarding", async integration => {
  await expect(Page({ searchParams: Promise.resolve({ integration, status: integration === "github" ? "installation_recorded" : "consent_recorded" }) })).rejects.toThrow(`/control/connection-return?integration=${integration}&status=${integration === "github" ? "installation_recorded" : "consent_recorded"}`);
});
it("preserves the ordinary sign-in destination", async () => {
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("/control");
});

it.each([{ integration: "jira", status: "PRIVATE_TEXT" }, { integration: "jira", status: ["declined", "consent_recorded"] }])("drops unvalidated callback status %#", async params => {
  await expect(Page({ searchParams: Promise.resolve(params) })).rejects.toThrow(/^\/control\/connection-return\?integration=jira$/);
});
it.each(["https://attacker.invalid", "__proto__", ["jira", "slack"]])("rejects unknown or duplicate integration %#", async integration => {
  await expect(Page({ searchParams: Promise.resolve({ integration, status: "consent_recorded" }) })).rejects.toThrow(/^\/control$/);
});
it.each(['slack','teams','linear'].flatMap(integration=>['authorization_required','exchange_outcome_unknown','record_outcome_unknown','connection_changed'].map(status=>({integration,status}))))('preserves safe callback recovery across forwarding $integration/$status',async params=>{await expect(Page({searchParams:Promise.resolve(params)})).rejects.toThrow(`/control/connection-return?integration=${params.integration}&status=${params.status}`)});
