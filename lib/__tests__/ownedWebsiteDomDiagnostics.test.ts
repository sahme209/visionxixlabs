import { readFileSync } from "node:fs";
import vm from "node:vm";
import { expect, it } from "vitest";

// Execute the actual driver's pure polling code with synthetic DOM/CDP values;
// importing the executable driver would start its owned-runtime recipe.
const source = readFileSync(`${process.cwd()}/scripts/capture-owned-website.mjs`, "utf8");
const start = source.indexOf("  async function waitFor(");
const end = source.indexOf("  async function viewport(", start);
if (start < 0 || end < 0) throw Error("driver_poll_source_missing");
const helpersAt = source.indexOf("function readPreImageDomSnapshot()");
const helpers = helpersAt < 0 ? "" : source.slice(helpersAt, source.indexOf("// Start the absolute clock", helpersAt));
const snapshot = { readyState: "interactive", tourPresent: true, playPresent: true, playDisabled: true, reducedMotion: false, visibility: "visible" };

function fixture(overrides: Record<string, unknown> = {}) {
  let now = 0, evaluations = 0;
  class Button { disabled = true; }
  const document = { readyState: snapshot.readyState, visibilityState: snapshot.visibility, querySelector: (selector: string) => selector === "#product-tour" ? {} : new Button(), ...overrides };
  const window = { matchMedia: () => ({ matches: false }) };
  const evaluate = async (fn: unknown, argument: unknown) => {
    evaluations++;
    return vm.compileFunction(`return (${String(fn)})(argument);`, ["document", "window", "argument", "HTMLButtonElement"])(document, window, argument, Button);
  };
  const build = vm.compileFunction(`${helpers}\nlet preImageWait = null;\n${source.slice(start, end)}\nreturn { waitFor, diagnostic: () => preImageWait, sanitize: typeof sanitizePreImageDomSnapshot === 'function' ? sanitizePreImageDomSnapshot : undefined };`, ["evaluate", "sleep", "Date", "assert"]);
  return { ...build(evaluate, async (ms: number) => { now += ms; }, { now: () => now }, { ok: (value: unknown) => { if (!value) throw Error("invalid_phase"); } }), evaluations: () => evaluations, elapsed: () => now };
}

it.each(["homepage_document", "homepage_playback"])("retains the exact %s timeout phase and last bounded DOM observation", async phase => {
  const f = fixture();
  await expect(f.waitFor(() => false, undefined, 300, phase)).rejects.toThrow("website_dom_timeout");
  expect(f.diagnostic()).toEqual({ phase, lastDomSnapshot: snapshot });
  expect(f.evaluations()).toBe(3); expect(f.elapsed()).toBe(300);
});

it("keeps the unchanged predicate result and uses no extra evaluation for diagnostics", async () => {
  const f = fixture(); await f.waitFor(() => true, undefined, 45000, "homepage_document");
  expect(f.evaluations()).toBe(1); expect(f.elapsed()).toBe(0); expect(f.diagnostic()).toBeNull();
  await expect(f.waitFor(() => false, undefined, 300)).rejects.toThrow("website_dom_timeout");
  expect(f.diagnostic()).toBeNull(); expect(f.evaluations()).toBe(4);
});

it("keeps unavailable DOM observations unknown without retaining page text or allowing readiness", async () => {
  const f = fixture({ readyState: "private-page-text" });
  await expect(f.waitFor(() => false, undefined, 300, "homepage_playback")).rejects.toThrow("website_dom_timeout");
  expect(f.diagnostic()).toEqual({ phase: "homepage_playback", lastDomSnapshot: null });
  expect(JSON.stringify(f.diagnostic())).not.toContain("private-page-text");
});

it("accepts only six own data fields with closed strings and boolean or absent-control state", () => {
  const f = fixture(); expect(f.sanitize).toBeTypeOf("function");
  expect(f.sanitize(snapshot)).toEqual(snapshot);
  expect(f.sanitize({ ...snapshot, playPresent: false, playDisabled: null })).toEqual({ ...snapshot, playPresent: false, playDisabled: null });
  let reads = 0; const accessor = { ...snapshot }; Object.defineProperty(accessor, "readyState", { get() { reads++; return "private-page-text"; } });
  for (const value of [accessor, { ...snapshot, rawHtml: "private-page-text" }, { ...snapshot, visibility: "unknown" }, { ...snapshot, playDisabled: null }, { ...snapshot, tourPresent: 1 }, { ...snapshot, reducedMotion: "false" }]) expect(f.sanitize(value)).toBeNull();
  expect(reads).toBe(0);
});
