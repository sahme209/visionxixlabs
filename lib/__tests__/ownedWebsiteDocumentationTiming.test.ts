import { expect, it } from "vitest";
import { publicDocumentationTiming, publicSummary } from "../../scripts/owned-website-ci.mjs";

const timing = { startedMs: 99000, clickCompletedMs: 99015, preWaitCompletedMs: 99020, lastPollMs: 119900, pollCount: 180, observedMs: 120000 };

it("publishes bounded phase measurements without treating a deadline as acceptance", () => {
  const summary = publicSummary("a".repeat(40), { sourceHead: "a".repeat(40), cleanup: "owned_groups_empty" }, {
    currentInteraction: "documentation_check", failure: "website_driver_deadline", success: false, documentationTiming: timing,
  }, undefined, undefined);
  expect(summary.documentationTiming).toEqual(timing);
  expect(summary.outcome).toBe("failed");
  expect(summary.captureSuccess).toBe(false);
});

it("retains partial phase observations without inventing a completed click or poll", () => {
  const partial = { ...timing, clickCompletedMs: null, preWaitCompletedMs: null, lastPollMs: null, pollCount: 0 };
  expect(publicDocumentationTiming(partial)).toEqual(partial);
});

it("refuses unknown fields, coercible values and out-of-range timing/counters", () => {
  for (const value of [
    { ...timing, url: "PRIVATE_URL" }, { ...timing, [Symbol("private")]: 1 },
    { ...timing, startedMs: "PRIVATE" }, { ...timing, startedMs: -1 },
    { ...timing, observedMs: 120001 }, { ...timing, observedMs: NaN },
    { ...timing, clickCompletedMs: 1.5 }, { ...timing, pollCount: 4097 },
    { ...timing, pollCount: null }, Object.assign(Object.create({}), timing),
  ]) expect(publicDocumentationTiming(value)).toBeNull();
  let reads = 0;
  const accessor = { ...timing };
  Object.defineProperty(accessor, "startedMs", { enumerable: true, get() { reads++; return "PRIVATE"; } });
  expect(publicDocumentationTiming(accessor)).toBeNull();
  expect(reads).toBe(0);
});

it("ignores the timing field outside the two fixed documentation interactions", () => {
  let reads = 0;
  const capture = { currentInteraction: "home-desktop", get documentationTiming() { reads++; return timing; } };
  const summary = publicSummary("a".repeat(40), undefined, capture, undefined, undefined);
  expect(summary.documentationTiming).toBeNull();
  expect(reads).toBe(0);
});

it("does not invoke a top-level timing accessor even in the permitted phase", () => {
  let reads = 0;
  const capture = { currentInteraction: "documentation_check", get documentationTiming() { reads++; return timing; } };
  expect(publicSummary("a".repeat(40), undefined, capture, undefined, undefined).documentationTiming).toBeNull();
  expect(reads).toBe(0);
});
