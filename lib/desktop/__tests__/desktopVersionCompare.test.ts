import { expect, it } from "vitest";
import { desktopUpdateState } from "../desktopVersionCompare";
it("compares installed and published versions numerically", () => {
  expect(desktopUpdateState("0.1.25", "desktop-v0.1.25")).toEqual({ kind: "current", latest: "0.1.25" });
  expect(desktopUpdateState("0.1.9", "desktop-v0.1.25")).toEqual({ kind: "available", latest: "0.1.25" });
  expect(desktopUpdateState("0.2.0", "desktop-v0.1.25")).toEqual({ kind: "ahead", latest: "0.1.25" });
});
it("stays unknown for anything it cannot read", () => {
  expect(desktopUpdateState(null, "desktop-v0.1.25").kind).toBe("unknown");
  expect(desktopUpdateState("0.1.25", undefined).kind).toBe("unknown");
  expect(desktopUpdateState("0.1.25-beta", "desktop-v0.1.25").kind).toBe("unknown");
});
