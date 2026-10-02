import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../currentContext.ts", import.meta.url), "utf8");

describe("current workspace authority contract", () => {
  it("does not recover workspace authority from mutable login-session roles", () => {
    expect(source).toContain("Login-session claims are not authority.");
    expect(source).not.toContain("return Array.isArray(input.sessionRoles)");
    expect(source).not.toContain("sessionRoles:");
  });
});
