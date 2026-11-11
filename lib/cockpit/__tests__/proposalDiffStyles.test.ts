import { expect, it } from "vitest";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { readFileSync } from "node:fs";

it("ships the shared file diff's four-column rows in the website stylesheet", async () => {
  const result = await postcss([tailwindcss({ optimize: false })]).process(readFileSync("app/globals.css", "utf8"), { from: "app/globals.css" });
  const rows: string[] = [];
  result.root.walkDecls("grid-template-columns", declaration => { rows.push(declaration.value.replace(/,\s+/g, ",")); });
  expect(rows).toContain("2.5rem 2.5rem 1.25rem minmax(0,1fr)");
});
