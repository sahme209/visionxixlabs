/** @vitest-environment jsdom */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AuditLogsPage from "../page";
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
afterEach(cleanup);
it("answers the audit guide promise with evidence stages rather than redirecting", () => {
 render(createElement(AuditLogsPage));
 expect(screen.getByRole("heading", {level:1}).textContent).toContain("Read the evidence, not just the status.");
 for(const name of ["Review the original record", "Separate decisions from effects", "Handle an uncertain result", "Share evidence safely"])
 expect(screen.getByRole("heading", {name})).toBeTruthy();
});
it("preserves unknown histories and limits assurance claims", () => {
 const {container}=render(createElement(AuditLogsPage));
 for(const phrase of ["Coverage and available controls vary", "A timeout does not prove that nothing happened", "Do not resend", "not an independent attestation", "does not prove rollback", "Do not publish tokens"])
 expect(container.textContent).toContain(phrase);
 expect(container.querySelector("button,form,input")).toBeNull();
});
it("provides plan and recovery destinations", () => {
 render(createElement(AuditLogsPage));
 expect(screen.getByRole("link", {name:"Understand execution plans"}).getAttribute("href")).toBe("/docs/execution-plans");
 expect(screen.getByRole("link", {name:"Troubleshoot an uncertain operation"}).getAttribute("href")).toBe("/docs/troubleshooting");
});
