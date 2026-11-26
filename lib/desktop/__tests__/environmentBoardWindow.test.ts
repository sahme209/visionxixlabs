import { describe, expect, it, vi } from "vitest";
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: {} }));
import { windowBadge } from "../../../desktop/src/components/EnvironmentBoard";
const now = new Date("2026-11-27T12:00:00Z"); // Friday
describe("environment board window badge", () => {
  it("labels open, closed, frozen and unreadable windows, and nothing without a rule", () => {
    expect(windowBadge(null, now)).toBeNull();
    expect(windowBadge({ utcWindows: [{ start: "10:00", end: "14:00" }] }, now)?.label).toBe("window open");
    expect(windowBadge({ weekdays: ["Mon"], utcWindows: [{ start: "10:00", end: "14:00" }] }, now)?.label).toBe("window closed");
    expect(windowBadge({ freezes: [{ startUtc: "2026-11-27T00:00:00Z", endUtc: "2026-11-28T00:00:00Z", reason: "Sale" }] }, now)).toMatchObject({ label: "frozen", title: expect.stringContaining("Sale") });
    expect(windowBadge({ utcWindows: "x" }, now)?.label).toBe("window rule unreadable");
  });
});
