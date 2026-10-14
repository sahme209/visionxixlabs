import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  eventCreate: vi.fn(),
  txUpdate: vi.fn(),
  txFindUnique: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  sendConfirmation: vi.fn(),
}));

vi.mock("stripe", () => ({ default: class StripeMock { webhooks = { constructEvent: mocks.constructEvent }; } }));
vi.mock("@/lib/supporters/email", () => ({ sendSupporterConfirmation: mocks.sendConfirmation }));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      supporterStripeEvent: { create: mocks.eventCreate },
      foundingSupporterPurchase: { update: mocks.txUpdate, findUnique: mocks.txFindUnique },
    }),
    foundingSupporterPurchase: { findUnique: mocks.findUnique, update: mocks.update },
  },
}));

import { POST } from "../route";

const purchase = { id: "support_1", email: "supporter@example.com", displayName: "A Supporter", amountCents: 100, confirmationEmailSentAt: null };
const paidEvent = { id: "evt_paid_1", type: "checkout.session.completed", data: { object: { id: "cs_test_1", payment_status: "paid", payment_intent: "pi_test_1", metadata: { purpose: "axiom_founding_supporter", supporterPurchaseId: "support_1" } } } };

function request() {
  return new NextRequest("https://preview.visionxixlabs.com/api/support/stripe-webhook", { method: "POST", headers: { "stripe-signature": "signed" }, body: "raw-event" });
}

describe("POST /api/support/stripe-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_SUPPORTER_WEBHOOK_SECRET = "whsec_test";
    process.env.SUPPORTER_BADGE_SIGNING_SECRET = "badge-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://preview.visionxixlabs.com";
    mocks.constructEvent.mockReturnValue(paidEvent);
    mocks.eventCreate.mockResolvedValue({});
    mocks.txUpdate.mockResolvedValue(purchase);
    mocks.txFindUnique.mockResolvedValue(purchase);
    mocks.findUnique.mockResolvedValue(purchase);
    mocks.update.mockResolvedValue({});
    mocks.sendConfirmation.mockResolvedValue(true);
  });

  it("confirms payment, records the event, sends confirmation, and marks delivery", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.eventCreate).toHaveBeenCalledWith({ data: { id: "evt_paid_1", type: "checkout.session.completed" } });
    expect(mocks.txUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "support_1" }, data: expect.objectContaining({ status: "paid", stripePaymentIntentId: "pi_test_1" }) }));
    expect(mocks.sendConfirmation).toHaveBeenCalledWith(expect.objectContaining({ email: "supporter@example.com", amountCents: 100, badgeUrl: expect.stringContaining("/api/support/badge/support_1?token=") }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "support_1" }, data: { confirmationEmailSentAt: expect.any(Date) } }));
  });

  it("does not repeat financial mutation but retries an unsent email on duplicate delivery", async () => {
    mocks.eventCreate.mockRejectedValue({ code: "P2002" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ replay: true });
    expect(mocks.sendConfirmation).toHaveBeenCalledOnce();
  });

  it("returns 500 so Stripe retries when confirmation delivery fails", async () => {
    mocks.sendConfirmation.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("records a full refund and revokes paid badge status", async () => {
    mocks.constructEvent.mockReturnValue({ id: "evt_refund_1", type: "charge.refunded", data: { object: { payment_intent: "pi_test_1", amount_refunded: 100 } } });
    mocks.txFindUnique.mockResolvedValue({ ...purchase, amountCents: 100 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.txUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "refunded", refundedAmountCents: 100 }) }));
    expect(mocks.sendConfirmation).not.toHaveBeenCalled();
  });

  it("rejects an invalid webhook signature before persistence", async () => {
    mocks.constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });
});
