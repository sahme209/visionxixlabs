/**
 * Vitest unit tests for the pure i18n bundle validator.
 */

import { describe, it, expect } from "vitest";
import { validateLocaleBundles, type LocaleBundle } from "../bundleValidator";

const B = (locale: string, messages: Record<string, string>): LocaleBundle => ({ locale, messages });

describe("validateLocaleBundles", () => {
  it("identical bundles → coverage 1, status ok", () => {
    const r = validateLocaleBundles({
      base:   B("en", { hello: "Hello", world: "World" }),
      others: [B("es", { hello: "Hola",  world: "Mundo" })],
    });
    expect(r.locales[0].coverage).toBe(1);
    expect(r.locales[0].status).toBe("ok");
    expect(r.overall).toBe("ok");
  });

  it("missing key → finding + coverage drop", () => {
    const r = validateLocaleBundles({
      base:   B("en", { hello: "Hello", world: "World" }),
      others: [B("es", { hello: "Hola" })],
    });
    const f = r.locales[0].findings.find((x) => x.kind === "missing_key")!;
    expect(f.key).toBe("world");
    expect(r.locales[0].coverage).toBe(0.5);
  });

  it("extra key flagged", () => {
    const r = validateLocaleBundles({
      base:   B("en", { hello: "Hello" }),
      others: [B("es", { hello: "Hola", extra: "Extra" })],
    });
    expect(r.locales[0].findings.some((f) => f.kind === "extra_key" && f.key === "extra")).toBe(true);
  });

  it("empty target string → empty_string finding", () => {
    const r = validateLocaleBundles({
      base:   B("en", { greeting: "Hello {name}" }),
      others: [B("es", { greeting: "" })],
    });
    expect(r.locales[0].findings.some((f) => f.kind === "empty_string")).toBe(true);
  });

  it("placeholder mismatch flagged + drops status from ok", () => {
    const r = validateLocaleBundles({
      base:   B("en", { greeting: "Hi {name}!" }),
      others: [B("es", { greeting: "Hola {nombre}!" })], // {nombre} ≠ {name}
    });
    expect(r.locales[0].findings.some((f) => f.kind === "placeholder_mismatch")).toBe(true);
    expect(r.locales[0].status).toBe("warn");
  });

  it("coverage 90-100% with no placeholder issue → warn", () => {
    const base: Record<string, string> = {};
    const target: Record<string, string> = {};
    for (let i = 0; i < 10; i++) base[`k${i}`] = String(i);
    for (let i = 0; i < 9; i++) target[`k${i}`] = String(i);
    const r = validateLocaleBundles({ base: B("en", base), others: [B("es", target)] });
    expect(r.locales[0].coverage).toBeCloseTo(0.9, 5);
    expect(r.locales[0].status).toBe("warn");
  });

  it("coverage < 90% → incomplete", () => {
    const base: Record<string, string> = {};
    const target: Record<string, string> = {};
    for (let i = 0; i < 10; i++) base[`k${i}`] = String(i);
    for (let i = 0; i < 5; i++) target[`k${i}`] = String(i);
    const r = validateLocaleBundles({ base: B("en", base), others: [B("es", target)] });
    expect(r.locales[0].status).toBe("incomplete");
    expect(r.overall).toBe("incomplete");
  });

  it("multiple target locales: overall = worst", () => {
    const r = validateLocaleBundles({
      base:   B("en", { a: "A", b: "B" }),
      others: [
        B("es", { a: "A", b: "B" }),    // ok
        B("fr", { a: "A" }),             // incomplete (50%)
      ],
    });
    expect(r.overall).toBe("incomplete");
  });

  it("empty base bundle → coverage 1 (vacuous truth)", () => {
    const r = validateLocaleBundles({
      base:   B("en", {}),
      others: [B("es", { extra: "Extra" })],
    });
    expect(r.locales[0].coverage).toBe(1);
    expect(r.locales[0].findings.some((f) => f.kind === "extra_key")).toBe(true);
  });
});
