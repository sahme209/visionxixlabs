import type Stripe from "stripe";
/** Known installed-SDK shapes, not a card-only policy. Unknown/multiple source
 * shapes and customer cash balance remain unsupported in this inactive lane. */
const methods = ["ach_credit_transfer", "ach_debit", "acss_debit", "affirm", "afterpay_clearpay", "alipay", "alma", "amazon_pay", "au_becs_debit", "bacs_debit", "bancontact", "billie", "blik", "boleto", "card", "card_present", "cashapp", "crypto", "eps", "fpx", "giropay", "grabpay", "ideal", "interac_present", "kakao_pay", "klarna", "konbini", "kr_card", "link", "mb_way", "mobilepay", "multibanco", "naver_pay", "nz_bank_account", "oxxo", "p24", "pay_by_bank", "payco", "paynow", "paypal", "payto", "pix", "promptpay", "revolut_pay", "samsung_pay", "satispay", "sepa_credit_transfer", "sepa_debit", "sofort", "stripe_account", "swish", "twint", "us_bank_account", "wechat", "wechat_pay", "zip"] as const satisfies readonly (keyof Stripe.Charge.PaymentMethodDetails)[];
export const supportedChargeMethodType = (value: unknown): value is typeof methods[number] => typeof value === "string" && (methods as readonly string[]).includes(value);
export function identifiedChargeSource(details: Stripe.Charge.PaymentMethodDetails | null): string | null {
  if (!details || !supportedChargeMethodType(details.type)) return null;
  const fields = Object.entries(details).filter(([key, value]) => key !== "type" && value !== undefined && value !== null);
  if (fields.length !== 1 || fields[0][0] !== details.type || typeof fields[0][1] !== "object" || Array.isArray(fields[0][1])) return null;
  return details.type;
}
