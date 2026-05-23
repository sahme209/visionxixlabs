import { describe, it, expect } from "vitest";
import {
  mintApiKey,
  parseApiKey,
  hashApiKey,
  prefixOf,
  verifyKeyHash,
} from "../apiKeyCrypto";

describe("mintApiKey", () => {
  it("produces a syntactically valid key by default (live env)", () => {
    const k = mintApiKey();
    expect(k.env).toBe("live");
    expect(k.plaintext.startsWith("vxlk_live_")).toBe(true);
    expect(k.plaintext.split("_")).toHaveLength(4);
  });

  it("supports test env", () => {
    const k = mintApiKey("test");
    expect(k.plaintext.startsWith("vxlk_test_")).toBe(true);
  });

  it("returns prefix that matches prefixOf(plaintext)", () => {
    const k = mintApiKey();
    expect(k.prefix).toBe(prefixOf(k.plaintext));
  });

  it("returns keyHash that matches hashApiKey(plaintext)", () => {
    const k = mintApiKey();
    expect(k.keyHash).toBe(hashApiKey(k.plaintext));
  });

  it("produces unique keys across calls (entropy check)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const k = mintApiKey();
      expect(seen.has(k.plaintext)).toBe(false);
      seen.add(k.plaintext);
    }
  });
});

describe("parseApiKey — happy paths", () => {
  it("parses a freshly-minted live key", () => {
    const k = mintApiKey("live");
    const r = parseApiKey(k.plaintext);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.env).toBe("live");
      expect(r.prefix).toBe(k.prefix);
    }
  });

  it("parses a freshly-minted test key", () => {
    const k = mintApiKey("test");
    const r = parseApiKey(k.plaintext);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.env).toBe("test");
  });
});

describe("parseApiKey — rejections", () => {
  it("rejects wrong number of underscores", () => {
    const r = parseApiKey("vxlk_live_secret");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_format");
  });

  it("rejects wrong brand", () => {
    const r = parseApiKey("sktest_live_ABCDEFGHJKMNPQRSTVWXYZAB_ABCDEF");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_brand");
  });

  it("rejects wrong env (not live/test)", () => {
    const r = parseApiKey("vxlk_staging_ABCDEFGHJKMNPQRSTVWXYZAB_ABCDEF");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_env");
  });

  it("rejects secret length != 24", () => {
    const r = parseApiKey("vxlk_live_SHORT_ABCDEF");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_secret_length");
  });

  it("rejects checksum length != 6", () => {
    // 24-char secret but only 3-char checksum
    const r = parseApiKey("vxlk_live_ABCDEFGHJKMNPQRSTVWXYZAB_ABC");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("wrong_checksum_length");
  });

  it("rejects checksum that doesn't match secret (typo detection)", () => {
    const k = mintApiKey();
    // Flip one char of the checksum
    const parts = k.plaintext.split("_");
    const flipped = parts[3][0] === "A" ? "B" + parts[3].slice(1) : "A" + parts[3].slice(1);
    parts[3] = flipped;
    const r = parseApiKey(parts.join("_"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad_checksum");
  });

  it("rejects characters outside the Crockford alphabet (e.g. lowercase)", () => {
    const r = parseApiKey("vxlk_live_abcdefghijklmnopqrstuvwx_ABCDEF");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // could be wrong_secret_length (regex rejects) — that's fine,
      // either way it's not "ok"
      expect(["wrong_secret_length", "bad_checksum"]).toContain(r.reason);
    }
  });
});

describe("hashApiKey", () => {
  it("returns a 64-char hex string", () => {
    const h = hashApiKey("vxlk_live_ABCDEFGHJKMNPQRSTVWXYZAB_ABCDEF");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const a = hashApiKey("vxlk_live_AAAAAAAAAAAAAAAAAAAAAAAA_ABCDEF");
    const b = hashApiKey("vxlk_live_AAAAAAAAAAAAAAAAAAAAAAAA_ABCDEF");
    expect(a).toBe(b);
  });

  it("differs for different inputs", () => {
    const a = hashApiKey("vxlk_live_AAAAAAAAAAAAAAAAAAAAAAAA_ABCDEF");
    const b = hashApiKey("vxlk_live_BBBBBBBBBBBBBBBBBBBBBBBB_ABCDEF");
    expect(a).not.toBe(b);
  });
});

describe("verifyKeyHash", () => {
  it("returns true for equal hex strings", () => {
    const h = hashApiKey("vxlk_live_AAAAAAAAAAAAAAAAAAAAAAAA_ABCDEF");
    expect(verifyKeyHash(h, h)).toBe(true);
  });

  it("returns false for different hex strings of same length", () => {
    const a = hashApiKey("vxlk_live_AAAAAAAAAAAAAAAAAAAAAAAA_ABCDEF");
    const b = hashApiKey("vxlk_live_BBBBBBBBBBBBBBBBBBBBBBBB_ABCDEF");
    expect(verifyKeyHash(a, b)).toBe(false);
  });

  it("returns false for different lengths (no throw)", () => {
    expect(verifyKeyHash("aabb", "aabbcc")).toBe(false);
  });

  it("returns false on malformed hex (no throw)", () => {
    expect(verifyKeyHash("not-hex", "also-not")).toBe(false);
  });
});

describe("prefixOf", () => {
  it("returns 14-char prefix (vxlk_live_xxxx)", () => {
    const k = mintApiKey();
    expect(k.prefix.length).toBe(14);
    expect(k.prefix.startsWith("vxlk_live_")).toBe(true);
  });
});
