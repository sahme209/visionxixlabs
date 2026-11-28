import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checksum, guardStatements, migrationNames } from "../../deploy/self-hosted/migrate.mjs";

describe("self-hosted fresh install", () => {
  it("records every migration with its real checksum", () => {
    const names: string[] = migrationNames();
    expect(names).toEqual(readdirSync("prisma/migrations", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort());
    expect(checksum(names[0])).toMatch(/^[0-9a-f]{64}$/);
  });
  it("re-creates every integrity guard (function and trigger) that migrations add", () => {
    const all = names().map((n) => readFileSync(`prisma/migrations/${n}/migration.sql`, "utf8")).join("\n");
    const expected = (all.match(/CREATE (OR REPLACE )?FUNCTION/g) ?? []).length + (all.match(/CREATE TRIGGER/g) ?? []).length;
    const guards: string[] = guardStatements();
    expect(guards.length).toBe(expected);
    expect(guards.every((g) => g.trimEnd().endsWith(";"))).toBe(true);
    expect(all).not.toMatch(/DROP (TRIGGER|FUNCTION)/);
  });
});
const names = (): string[] => migrationNames();
