import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../app/download/page.tsx", import.meta.url), "utf8");

describe("desktop download customer path", () => {
  it("routes every pre-hydration platform CTA through the server manifest resolver", () => {
    for (const platform of ["mac-arm", "mac-intel", "windows", "linux"]) {
      expect(source).toContain(`/api/desktop/download?platform=${platform}`);
    }
  });

  it("does not advertise a preview waitlist or a future signing promise", () => {
    expect(source).not.toContain("Join desktop preview");
    expect(source).not.toContain("signed builds in 1.0");
    expect(source).not.toContain("MSI + EV signing in 1.0");
  });
});
