import { expect, it } from "vitest";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import config from "../../../tailwind.config";

it("ships the shared file diff's four-column rows in the website stylesheet", async () => {
  const result = await postcss([tailwindcss(config)]).process("@tailwind utilities;", { from: undefined });
  const rows: string[] = [];
  result.root.walkDecls("grid-template-columns", declaration => { rows.push(declaration.value); });
  expect(rows).toContain("2.5rem 2.5rem 1.25rem minmax(0,1fr)");
});
