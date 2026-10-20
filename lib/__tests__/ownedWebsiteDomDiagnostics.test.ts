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

function fixture(overrides: Record<string, unknown> = {}, resources: unknown[] = []) {
  let now = 0, evaluations = 0;
  class Button { disabled = true; }
  const document = { readyState: snapshot.readyState, visibilityState: snapshot.visibility, querySelector: (selector: string) => selector === "#product-tour" ? {} : new Button(), ...overrides };
  const window = { matchMedia: () => ({ matches: false }) };
  const evaluate = async (fn: unknown, argument: unknown) => {
    evaluations++;
    return vm.compileFunction(`return (${String(fn)})(argument);`, ["document", "window", "argument", "HTMLButtonElement", "performance"])(document, window, argument, Button, { getEntriesByType: () => resources });
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

it("fails immediately on a missing playback control while retaining the same-poll DOM snapshot", async () => {
  const f = fixture({ readyState: "complete", querySelector: (selector: string) => selector === "#product-tour" ? {} : null });
  await expect(f.waitFor(() => !document.querySelector<HTMLButtonElement>('[aria-label="Play story"]')!.disabled, undefined, 45000, "homepage_playback")).rejects.toThrow("website_browser_evaluation_failed");
  expect(f.evaluations()).toBe(1); expect(f.elapsed()).toBe(0);
  expect(f.diagnostic()).toEqual({ phase: "homepage_playback", predicateExceptionClass: "TypeError", lastDomSnapshot: { ...snapshot, readyState: "complete", playPresent: false, playDisabled: null } });
});

it("redacts unknown predicate exception names and keeps document-state screenshot before mandatory playback checks", async () => {
  const f = fixture();
  await expect(f.waitFor(() => { throw { name: "PRIVATE_URL", message: "PRIVATE_SECRET" }; }, undefined, 45000, "homepage_playback")).rejects.toThrow("website_browser_evaluation_failed");
  expect(f.diagnostic().predicateExceptionClass).toBe("other"); expect(JSON.stringify(f.diagnostic())).not.toContain("PRIVATE");
  const documentReady = source.indexOf("await navigate('/', 'homepage_document')");
  const screenshot = source.indexOf("await frame('home-desktop')");
  const playback = source.indexOf("undefined, 45000, 'homepage_playback'");
  expect(documentReady).toBeGreaterThan(0); expect(screenshot).toBeGreaterThan(documentReady); expect(playback).toBeGreaterThan(screenshot);
  expect(source.match(/await frame\('/g)).toHaveLength(6);
});

it("retains only a closed CDP evaluation exception class and still fails immediately", async () => {
  const evaluateStart = source.indexOf("  async function evaluate(");
  const evaluateEnd = source.indexOf("  /** @param", evaluateStart);
  const build = vm.compileFunction(`let evaluationExceptionClass = null; ${source.slice(evaluateStart, evaluateEnd)}; return { evaluate, diagnostic: () => evaluationExceptionClass };`, ["send", "assert"]);
  for (const [name, expected] of [["TypeError", "TypeError"], ["PRIVATE_URL", "other"]]) {
    const f = build(async () => ({ exceptionDetails: { exception: { className: name, description: "PRIVATE_SECRET" } } }), { ok: (value: unknown, message: string) => { if (!value) throw Error(message); } });
    await expect(f.evaluate(() => true)).rejects.toThrow("website_browser_evaluation_failed");
    expect(f.diagnostic()).toBe(expected);
  }
});

it("counts script elements and resource statuses without retaining script content or URLs", () => {
 const read = vm.compileFunction(`${helpers}; return readScriptCounts();`, ["document", "performance"]);
 const counts = read({ scripts: [{ hasAttribute: () => true, src: "PRIVATE" }, { hasAttribute: () => false, text: "PRIVATE" }] }, { getEntriesByType: () => [
   { initiatorType: "script", responseStatus: 200, name: "PRIVATE" }, { initiatorType: "script", responseStatus: 404 },
   { initiatorType: "script" }, { initiatorType: "script", responseStatus: 0 }, { initiatorType: "img", responseStatus: 200 },
 ] });
 expect(counts).toEqual({ elements: 2, external: 1, inline: 1, resourceSuccess: 1, resourceFailure: 1, resourceUnknown: 2 });
 expect(JSON.stringify(counts)).not.toContain("PRIVATE");
 expect(read({ scripts: [] }, { getEntriesByType: () => Array.from({ length: 4100 }, () => ({ initiatorType: "script", responseStatus: 200 })) }).resourceSuccess).toBe(4096);
 expect(read({}, {})).toBeNull();
});

it("keeps script diagnostics separate from the unchanged six-field snapshot in the same poll", async () => {
 const f = fixture({ scripts: [{ hasAttribute: () => true }] }, [{ initiatorType: "script" }]);
 await expect(f.waitFor(() => false, undefined, 100, "homepage_playback")).rejects.toThrow("website_dom_timeout");
 expect(f.evaluations()).toBe(1);
 expect(f.diagnostic()).toEqual({ phase: "homepage_playback", lastDomSnapshot: snapshot, scriptCounts: { elements: 1, external: 1, inline: 0, resourceSuccess: 0, resourceFailure: 0, resourceUnknown: 1 } });
});
