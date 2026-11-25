export function aiCreditRefundAmount(refundedCents: number, priceCents: number, deliveredCents: number) {
  const refundedAmountCents = Math.min(refundedCents, priceCents);
  const reversedAICreditsCents = Math.min(deliveredCents, Math.ceil(deliveredCents * refundedAmountCents / priceCents));
  const status = refundedAmountCents === priceCents ? "refunded" : refundedAmountCents > 0 ? "partially_refunded" : "paid";
  return { refundedAmountCents, reversedAICreditsCents, status };
}
