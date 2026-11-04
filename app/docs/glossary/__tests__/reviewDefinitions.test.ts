// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import GlossaryPage from "../page";
afterEach(cleanup);
function definition(term: string) { return screen.getByText(term, { selector: "dt" }).nextElementSibling!.textContent!; }
it("defines action proposals using independent review without administrator-only authority", () => {
 render(createElement(GlossaryPage)); const text = definition("Action proposal");
 expect(text).toContain("authorized independent human reviewer"); expect(text).not.toContain("administrator"); expect(text).toContain("Approval alone does not execute");
});
it("qualifies separate requester execution as a local preview with current permission and version limits", () => {
 render(createElement(GlossaryPage)); const text = definition("Approval gate");
 expect(text).toContain("authorized independent human reviewer"); expect(text).not.toContain("administrator");
 expect(text).toContain("original requester"); expect(text).toContain("current permissions"); expect(text).toContain("installed version"); expect(text).toContain("local preview"); expect(text).toContain("not production-activated");
});
it("retains the other glossary terms and existing footer link", () => {
 const { container } = render(createElement(GlossaryPage));
 expect(container.querySelectorAll("dt")).toHaveLength(15);
 expect(definition("Audit record")).toBe("The stored record of a tool call, including the requested action, risk, status, actor, and outcome. Audit evidence is not an independent compliance certification.");
 expect(screen.getByRole("link", { name: /FAQ/ }).getAttribute("href")).toBe("/docs/faq");
});
