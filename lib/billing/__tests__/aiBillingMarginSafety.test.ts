import { describe, expect, it } from 'vitest';
import { applyMargin } from '../aiBillingMargin';

describe('AI customer billing margin safety', () => {
  it('keeps ordinary integer-cent accounting stable', () => {
    expect(applyMargin(0)).toBe(0);
    expect(applyMargin(1)).toBe(2);
    expect(applyMargin(2)).toBe(3);
    expect(applyMargin(100)).toBe(150);
  });
  it('refuses an unsafe customer debit even if provider cents are a safe integer', () => {
    expect(() => applyMargin(Number.MAX_SAFE_INTEGER)).toThrow('customer_billed_cents_invalid');
  });
});
