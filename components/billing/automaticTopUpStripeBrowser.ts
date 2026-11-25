"use client";

export type Card = {
  mount(container: HTMLElement): void;
  destroy(): void;
  on(event: "change", callback: (state: { complete: boolean }) => void): void;
};
export type StripeCardSetup = {
  elements(): { create(type: "card", options: object): Card };
  handleNextAction(input: { clientSecret: string }): Promise<unknown>;
  confirmCardSetup(secret: string, data: { payment_method: { card: Card } }): Promise<{
    error?: { message?: string }; setupIntent?: { status: string };
  }>;
};

type StripeWindow = Window & { Stripe?: (key: string) => StripeCardSetup | null };

export async function loadAutomaticTopUpStripe(key: string): Promise<StripeCardSetup> {
  if (!/^pk_test_[A-Za-z0-9_]+$/.test(key)) throw new Error("invalid_test_key");
  const host = window as StripeWindow;
  if (!host.Stripe) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      let timer: number;
      function finish(ok: boolean) {
        window.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (ok) resolve();
        else { script.remove(); reject(new Error("stripe_script_unavailable")); }
      }
      script.onload = () => finish(Boolean(host.Stripe));
      script.onerror = () => finish(false);
      timer = window.setTimeout(() => finish(false), 12_000);
      document.head.append(script);
    });
  }
  const stripe = host.Stripe?.(key);
  if (!stripe) throw new Error("stripe_client_unavailable");
  return stripe;
}
