import { describe, expect, it } from "vitest";
import { distributionFrom } from "../../../desktop/src/lib/distribution";

describe("desktop distribution flag", () => {
  it("only the exact Store value selects the Store build", () => {
    expect(distributionFrom("microsoft_store")).toBe("microsoft_store");
    for (const v of [undefined, "", "store", "MICROSOFT_STORE", 1, null]) expect(distributionFrom(v)).toBe("direct");
  });
});
