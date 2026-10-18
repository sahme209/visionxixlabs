import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
const manifest = { version: "axiom_owned_checkout_v1", session: "a".repeat(32), runtimeId: "runtime", accountId: "acct-test", organizationId: "org", origin: "http://127.0.0.1:4100", directory: "/tmp/axiom-owned-checkout-" + "b".repeat(32), capability: "c".repeat(64) } as const;
const command = { kind: "checkout", userId: "owner", organizationId: "org", clientIntentKey: "purchase_key_123456789", planId: "pro", interval: "monthly" } as const;
describe("owned Checkout channel facts (no socket or provider)", () => {
  it("authenticates scope, session, sequence and exact command bytes", async () => {
    const p = await import("../ownedCheckoutBridge/protocol");
    const frame = p.sealFrame(manifest, "request", 1, "d".repeat(32), command);
    expect(p.openFrame(manifest, "request", 1, frame)).toMatchObject({ id: "d".repeat(32), body: command });
    for (const replacement of [{ ...manifest, organizationId: "foreign" }, { ...manifest, capability: "e".repeat(64) }, { ...manifest, session: "f".repeat(32) }]) expect(() => p.openFrame(replacement, "request", 1, frame)).toThrow("owned_checkout_channel_invalid");
    expect(() => p.openFrame(manifest, "request", 2, frame)).toThrow();
    expect(() => p.openFrame(manifest, "response", 1, frame)).toThrow();
    const mutated = JSON.parse(frame.toString("utf8")); mutated.body.planId = "enterprise";
    expect(() => p.openFrame(manifest, "request", 1, Buffer.from(JSON.stringify(mutated)))).toThrow();
  });
  it("bounds exact command schemas, raw bytes and response facts", async () => {
    const p = await import("../ownedCheckoutBridge/protocol");
    expect(p.checkoutCommand(command, manifest)).toEqual(command);
    for (const bad of [{ ...command, priceId: "price-caller" }, { ...command, organizationId: "foreign" }, { ...command, userId: "" }, { ...command, clientIntentKey: "short" }, { ...command, seatQuantity: 9 }]) expect(() => p.checkoutCommand(bad, manifest)).toThrow();
    const raw = Buffer.from('{"description":"é €"}', "utf8");
    expect(p.webhookCommand({ kind: "reconcile", body: raw.toString("base64"), signature: "signed" })).toEqual({ kind: "reconcile", body: raw.toString("base64"), signature: "signed" });
    expect(() => p.webhookCommand({ kind: "reconcile", body: Buffer.alloc(262145).toString("base64"), signature: "signed" })).toThrow();
    expect(() => p.webhookCommand({ kind: "reconcile", body: "%%%%", signature: "signed" })).toThrow();
    expect(() => p.webhookCommand({ kind: "reconcile", body: Buffer.from([255]).toString("base64"), signature: "signed" })).toThrow();
    expect(() => p.webhookCommand({ kind: "reconcile", body: raw.toString("base64"), signature: "x".repeat(4097) })).toThrow();
    expect(() => p.bridgeResult({ kind: "checkout_ready", url: "https://evil.invalid/" })).toThrow();
    expect(() => p.bridgeResult({ kind: "unavailable", secret: "never-forward" })).toThrow();
    expect(p.bridgeResult({ kind: "checkout_ready", url: "https://checkout.stripe.com/c/pay/cs_test" })).toMatchObject({ kind: "checkout_ready" });
  });
  it("parses partial/coalesced bounded frames and refuses truncation without dispatch", async () => {
    const p = await import("../ownedCheckoutBridge/protocol");
    const frame = p.sealFrame(manifest, "request", 1, "d".repeat(32), command), packed = p.packFrame(frame), received: Buffer[] = [];
    const parser = p.frameReader(b => received.push(b));
    parser.push(packed.subarray(0, 2)); expect(received).toHaveLength(0);
    parser.push(Buffer.concat([packed.subarray(2), packed])); parser.end(); expect(received).toEqual([frame, frame]);
    const oversized = Buffer.alloc(4); oversized.writeUInt32BE(393217);
    expect(() => p.frameReader(() => { throw new Error("must_not_dispatch"); }).push(oversized)).toThrow("owned_checkout_channel_invalid");
    const truncated = p.frameReader(() => { throw new Error("must_not_dispatch"); }); truncated.push(packed.subarray(0, 6)); expect(() => truncated.end()).toThrow();
    expect(createHash("sha256").update(frame).digest("hex")).toHaveLength(64);
  });
});
