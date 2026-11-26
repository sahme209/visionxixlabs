import { expect, it } from "vitest";
import { changeWindowState, formatCountdown } from "../changeWindowState";
const w = { startUtc: "2026-11-26T10:00:00Z", endUtc: "2026-11-26T12:00:00Z" };
it("reports upcoming, open and ended phases against the supplied clock", () => {
  expect(changeWindowState(w, new Date("2026-11-26T08:30:00Z"))).toMatchObject({ phase: "upcoming", msToBoundary: 90 * 60_000, progress: 0 });
  expect(changeWindowState(w, new Date("2026-11-26T11:30:00Z"))).toMatchObject({ phase: "open", msToBoundary: 30 * 60_000, progress: 0.75 });
  expect(changeWindowState(w, new Date("2026-11-26T12:00:00Z"))).toMatchObject({ phase: "ended", msToBoundary: null, progress: 1 });
});
it("refuses an unreadable or inverted window", () => {
  expect(changeWindowState({ startUtc: "x", endUtc: "y" }, new Date()).phase).toBe("unreadable");
  expect(changeWindowState({ startUtc: w.endUtc, endUtc: w.startUtc }, new Date()).phase).toBe("unreadable");
});
it("formats countdowns compactly", () => {
  expect(formatCountdown(90 * 60_000)).toBe("1h 30m");
  expect(formatCountdown(26 * 3_600_000)).toBe("1d 2h");
  expect(formatCountdown(5 * 60_000)).toBe("5m");
  expect(formatCountdown(20_000)).toBe("under a minute");
});
