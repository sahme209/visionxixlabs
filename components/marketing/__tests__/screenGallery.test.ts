import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_TILES, SECURITY_TILES } from "../ProductBento";

describe("screen galleries", () => {
  for (const [name, tiles] of [["home", HOME_TILES], ["security", SECURITY_TILES]] as const) {
    it(`${name}: every image exists and links to a guide`, () => {
      for (const t of tiles) {
        expect(existsSync(join(process.cwd(), "public", t.src)), t.src).toBe(true);
        expect(t.href.startsWith("/docs/")).toBe(true);
      }
      expect(new Set(tiles.map((t) => t.src)).size).toBe(tiles.length);
    });
    it(`${name}: rows of three fill completely`, () => {
      let used = 0;
      for (const t of tiles) {
        const span = t.wide ? 2 : 1;
        expect(used + span <= 3, `${t.src} would wrap and leave a gap`).toBe(true);
        used = (used + span) % 3;
      }
      expect(used).toBe(0);
    });
  }
});
