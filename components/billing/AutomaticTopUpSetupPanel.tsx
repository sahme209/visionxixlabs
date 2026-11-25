"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadAutomaticTopUpStripe, type Card, type StripeCardSetup } from "./automaticTopUpStripeBrowser";

type Pack = { sku: string; priceCents: number };
type Consent = { sku: string; amountCents: number; revision: number; enabled: boolean; thresholdCents: number; monthlyCeilingCents: number };
type Pending = { attemptId: string | null; state: "registered" | "create_unconfirmed" | "payment_setup_pending" };
type PendingPayment = {
  state: "authentication_required" | "payment_failed" | "dispatch_unknown";
  amountCents: number;
  intentId: string | null;
  authenticationAvailable: boolean;
  cancellationAvailable: boolean;
};
type PaymentCommand = "authenticate_payment" | "verify_payment" | "cancel_payment";
type PaymentResult = { state: "authentication_ready" | "verified" | "pending" | "canceled"; clientSecret?: string };
type Snapshot = { consent: Consent | null; pending: Pending | null; payment: PendingPayment | null };
type CardSession = { card: Card; stripe: StripeCardSetup; secret: string; attemptId: string };
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const control = "mt-2 w-full rounded-lg border border-white/12 bg-[#121212] px-3 py-2 text-sm text-zinc-100";
const primary = "rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40";
const secondary = "rounded-lg border border-white/12 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5 disabled:opacity-40";

function usdCents(input: string) {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return amount <= 2_147_483_647 ? amount : null;
}

type Props = { organizationId: string; publishableKey: string; packs: ReadonlyArray<Pack>; providerConfigured: boolean };
export function AutomaticTopUpSetupPanel({ organizationId, publishableKey, packs, providerConfigured }: Props) {
  return <AutomaticTopUpWorkspace key={organizationId} {...{ organizationId, publishableKey, packs, providerConfigured }} />;
}

function AutomaticTopUpWorkspace({ organizationId, publishableKey, packs, providerConfigured }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [threshold, setThreshold] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [sku, setSku] = useState(packs[0]?.sku ?? "");
  const [accepted, setAccepted] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const pendingRequest = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const cardArea = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cardHeading = useRef<HTMLHeadingElement>(null);
  const payment = useRef<CardSession | null>(null);
  const pack = packs.find(p => p.sku === sku);

  function clearCard() {
    payment.current?.card.destroy();
    payment.current = null;
    setCardVisible(false);
    setCardComplete(false);
  }

  useEffect(() => {
    const lifetime = new AbortController();
    controller.current = lifetime;
    call<Snapshot>(organizationId, lifetime.signal).then(data => {
      if (lifetime.signal.aborted) return;
      setSnapshot(data);
      if (data.consent) {
        setThreshold((data.consent.thresholdCents / 100).toFixed(2));
        setCeiling((data.consent.monthlyCeilingCents / 100).toFixed(2));
        setSku(data.consent.sku);
      }
    }).catch(() => {
      if (!lifetime.signal.aborted) setError("Automatic top-up status could not be verified.");
    }).finally(() => { if (!lifetime.signal.aborted) setBusy(false); });
    return () => {
      lifetime.abort();
      payment.current?.card.destroy();
      payment.current = null;
    };
  }, [organizationId]);

  useEffect(() => {
    if (!cardVisible || !cardArea.current || !payment.current) return;
    const session = payment.current;
    try {
      session.card.mount(cardArea.current);
      cardHeading.current?.focus();
    } catch {
      session.card.destroy();
      payment.current = null;
      setCardVisible(false);
      setCardComplete(false);
      setError("The card form could not be opened. Cancel setup to try again.");
    }
  }, [cardVisible]);

  function run(operation: (signal: AbortSignal) => Promise<void>) {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || pendingRequest.current) return;
    pendingRequest.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    void operation(signal).catch(() => {
      if (!signal.aborted) {
        clearCard();
        setSnapshot(null);
        setError("The change could not be confirmed. Reload setup status before continuing.");
      }
    }).finally(() => {
      pendingRequest.current = false;
      if (!signal.aborted) setBusy(false);
    });
  }

  async function readStatus(signal: AbortSignal) {
    const view = await call<Snapshot>(organizationId, signal);
    if (!signal.aborted) setSnapshot(view);
  }

  function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const thresholdCents = usdCents(threshold);
    const monthlyCeilingCents = usdCents(ceiling);
    if (!snapshot || !accepted || !pack || thresholdCents === null || monthlyCeilingCents === null || monthlyCeilingCents < pack.priceCents) {
      setError("Enter a valid threshold and a monthly ceiling that covers at least one top-up, then accept the terms.");
      return;
    }
    run(async signal => {
      const stripe = await loadAutomaticTopUpStripe(publishableKey);
      if (signal.aborted) return;
      const registered = await call<{ state: string; attemptId: string | null }>(organizationId, signal, {
        action: "register", accepted: true, expectedRevision: snapshot.consent?.revision ?? null,
        thresholdCents, monthlyCeilingCents, sku: pack.sku,
      });
      if (registered.state !== "registered" || !registered.attemptId) {
        await readStatus(signal);
        return;
      }
      await showCard(signal, registered.attemptId, stripe, snapshot);
    });
  }

  async function showCard(signal: AbortSignal, attemptId: string, stripe: StripeCardSetup, view: Snapshot) {
    const ready = await call<{ state: string; clientSecret?: string }>(organizationId, signal, { action: "create", attemptId });
    if (signal.aborted) return;
    if (ready.state !== "ready" || !ready.clientSecret || !/^seti_[A-Za-z0-9]+_secret_[A-Za-z0-9_]+$/.test(ready.clientSecret) || !cardArea.current) {
      throw new Error("card_setup_unavailable");
    }
    const card = stripe.elements().create("card", {
      hidePostalCode: false, style: { base: { color: "#e4e4e7", fontSize: "16px", "::placeholder": { color: "#a1a1aa" } } },
    });
    payment.current = { stripe, card, secret: ready.clientSecret, attemptId };
    card.on("change", state => { if (!signal.aborted && payment.current?.card === card) setCardComplete(state.complete); });
    setSnapshot({ ...view, pending: { attemptId, state: "payment_setup_pending" } });
    setCardVisible(true);
  }

  async function finish(signal: AbortSignal, attemptId: string) {
    const result = await call<{ state: string }>(organizationId, signal, { action: "finish", attemptId });
    if (result.state !== "saved") throw new Error("setup_unverified");
    if (signal.aborted) return;
    clearCard();
    await readStatus(signal);
    if (!signal.aborted) { setNotice("Test payment setup verified."); heading.current?.focus(); }
  }

  function confirmCard() {
    const session = payment.current;
    if (!session || !cardComplete) return;
    run(async signal => {
      const result = await session.stripe.confirmCardSetup(session.secret, { payment_method: { card: session.card } });
      if (signal.aborted) return;
      if (result.setupIntent?.status !== "succeeded") {
        setError("Stripe hasn’t confirmed the test card. Check the card details or complete authentication and try again.");
        return;
      }
      clearCard();
      await finish(signal, session.attemptId);
    });
  }

  function disable() {
    if (!snapshot) return;
    run(async signal => {
      clearCard();
      const result = await call<{ state: string }>(organizationId, signal, { action: "disable", expectedRevision: snapshot.consent?.revision ?? null });
      if (result.state !== "off") throw new Error("setup_unverified");
      await readStatus(signal);
      if (!signal.aborted) {
        setAccepted(false);
        setNotice("Automatic top-up is off.");
        heading.current?.focus();
      }
    });
  }

  function recoverPayment(intentId: string, action: PaymentCommand) {
    run(async signal => {
      const stripe = action === "authenticate_payment" ? await loadAutomaticTopUpStripe(publishableKey) : null;
      if (signal.aborted) return;
      let result = await call<PaymentResult>(organizationId, signal, { action, intentId });
      if (signal.aborted) return;
      if (result.state === "authentication_ready") {
        const secret = result.clientSecret;
        if (!stripe || !secret || !/^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9_]+$/.test(secret)) throw new Error("authentication_unverified");
        try {
          await stripe.handleNextAction({ clientSecret: secret });
        } catch {
          // The provider result may be unknown after a dismissed challenge or connection loss.
        }
        if (signal.aborted) return;
        result = await call<PaymentResult>(organizationId, signal, { action: "verify_payment", intentId });
      }
      await readStatus(signal);
      if (signal.aborted) return;
      setNotice(result.state === "verified"
        ? "Test payment verified. Check AI credits for the available balance."
        : result.state === "canceled" ? "Test payment canceled. Automatic top-up settings are separate."
        : "The original test payment is still unconfirmed.");
      heading.current?.focus();
    });
  }

  return (
    <section className="mt-5 rounded-2xl border border-white/8 bg-[#171717] p-5 sm:p-7" aria-labelledby="automatic-top-up-heading">
      <h1 ref={heading} tabIndex={-1} id="automatic-top-up-heading" className="text-xl font-medium text-zinc-100">Automatic top-up</h1>
      <p className="mt-2 text-sm text-zinc-400">Test mode. Saving a test card creates no charge or credits.</p>
      <p className="mt-4 text-sm text-zinc-200">
        {snapshot ? snapshot.consent?.enabled ? "Test consent saved" : "Off" : busy ? "Checking setup status…" : "Setup status unavailable"}
      </p>

      {snapshot?.consent?.enabled && <dl className="mt-4 grid gap-3 rounded-xl border border-white/8 p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-zinc-400">Balance trigger</dt><dd>{money(snapshot.consent.thresholdCents)}</dd></div>
        <div><dt className="text-zinc-400">Fixed top-up</dt><dd>{money(snapshot.consent.amountCents)}</dd></div>
        <div><dt className="text-zinc-400">Monthly purchase ceiling</dt><dd>{money(snapshot.consent.monthlyCeilingCents)}</dd></div>
      </dl>}

      {snapshot?.payment && <PaymentRecovery payment={snapshot.payment} providerConfigured={providerConfigured} busy={busy} onRecover={recoverPayment} />}

      {snapshot && !snapshot.pending && !snapshot.consent?.enabled && providerConfigured && (
        <form className="mt-5 space-y-4" onSubmit={begin}>
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-zinc-300">Balance trigger (USD)
              <input className={control} inputMode="decimal" required value={threshold} onChange={event => setThreshold(event.target.value)} />
            </label>
            <label className="text-sm text-zinc-300">Fixed top-up
              <select className={control} value={sku} onChange={event => setSku(event.target.value)}>
                {packs.map(item => <option key={item.sku} value={item.sku}>{money(item.priceCents)}</option>)}
              </select>
            </label>
            <label className="text-sm text-zinc-300">Monthly purchase ceiling (USD)
              <input className={control} inputMode="decimal" required value={ceiling} onChange={event => setCeiling(event.target.value)} />
            </label>
          </fieldset>
          <label className="flex items-start gap-3 text-sm leading-6 text-zinc-300">
            <input type="checkbox" className="mt-1.5 size-4 shrink-0 accent-zinc-200" checked={accepted} disabled={busy} onChange={event => setAccepted(event.target.checked)} />
            <span>I agree to save a test card for automatic purchases of {pack ? money(pack.priceCents) : "the selected amount"} when the balance reaches the trigger, up to the separate monthly purchase ceiling. I can turn this off at any time.</span>
          </label>
          <button type="submit" className={primary} disabled={busy || !accepted}>Continue to test card</button>
        </form>
      )}

      {snapshot && !providerConfigured && <p className="mt-3 text-sm text-zinc-400">The test payment service is unavailable.</p>}
      {snapshot?.pending && !cardVisible && <div className="mt-5 rounded-xl border border-white/10 p-4">
        <p className="text-sm text-[#d1ad78]">
          {snapshot.pending.state === "create_unconfirmed" ? "The card setup is unconfirmed. Cancel setup before trying again."
            : snapshot.pending.state === "registered" ? "Your test setup is registered. Continue to the card form or cancel."
            : "A test card setup is pending. Verify it after Stripe confirms the card, or cancel."}
        </p>
        {snapshot.pending.attemptId && snapshot.pending.state === "registered" && providerConfigured && <button
          type="button" className={`${secondary} mt-3`} disabled={busy}
          onClick={() => {
            const attemptId = snapshot.pending?.attemptId;
            if (attemptId) run(async signal => {
              const stripe = await loadAutomaticTopUpStripe(publishableKey);
              if (!signal.aborted) await showCard(signal, attemptId, stripe, snapshot);
            });
          }}
        >Continue to test card</button>}
        {snapshot.pending.attemptId && snapshot.pending.state === "payment_setup_pending" && providerConfigured && <button
          className={`${secondary} mt-3`} type="button" disabled={busy}
          onClick={() => { const attemptId = snapshot.pending?.attemptId; if (attemptId) run(signal => finish(signal, attemptId)); }}
        >Verify test setup</button>}
      </div>}
      <div hidden={!cardVisible} className="mt-5 rounded-xl border border-white/10 p-4">
        <h2 tabIndex={-1} ref={cardHeading} className="text-base font-medium text-zinc-100">Test card details</h2>
        <div ref={cardArea} className="mt-3 rounded-lg border border-white/12 bg-[#121212] p-3" />
        <button className={`${primary} mt-4`} type="button" disabled={busy || !cardComplete} onClick={confirmCard}>Confirm test card</button>
      </div>
      {snapshot && (snapshot.pending || snapshot.consent?.enabled) && <button className={`${secondary} mt-4`} type="button" disabled={busy} onClick={disable}>
        {snapshot.consent?.enabled ? "Turn off automatic top-up" : "Cancel setup"}
      </button>}
      {!snapshot && !busy && <button className={`${secondary} mt-4`} type="button" onClick={() => run(readStatus)}>Reload setup status</button>}
      {error && <p role="alert" className="mt-4 text-sm text-[#d1ad78]">{error}</p>}
      {(busy || notice) && <p role="status" className="mt-4 text-sm text-zinc-300">{notice || "Checking setup…"} </p>}
    </section>
  );
}

function PaymentRecovery({ payment, providerConfigured, busy, onRecover }: {
  payment: PendingPayment; providerConfigured: boolean; busy: boolean;
  onRecover: (intentId: string, action: PaymentCommand) => void;
}) {
  const { intentId, state, amountCents, authenticationAvailable, cancellationAvailable } = payment;
  const title = state === "authentication_required" ? "Authentication required"
    : state === "payment_failed" ? "Payment declined" : "Payment unconfirmed";
  const explanation = state === "authentication_required"
    ? authenticationAvailable ? "Complete the card’s security check for the original payment." : "The original payment is on hold. Card authentication is unavailable here."
    : state === "payment_failed" ? "The original payment is on hold while Stripe confirms its status." : "V19 is waiting for Stripe to verify the original payment.";
  return (
    <section aria-labelledby="automatic-top-up-payment" className="mt-5 rounded-xl border border-[#343434] bg-[#1c1c1c] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="automatic-top-up-payment" className="text-sm font-medium text-zinc-100">{title}</h2>
        <span className="text-sm tabular-nums text-zinc-200">{money(amountCents)}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{explanation}</p>
      {intentId && providerConfigured && <div className="mt-4 flex flex-wrap gap-2">
        {authenticationAvailable && <button type="button" className={primary} disabled={busy} onClick={() => onRecover(intentId, "authenticate_payment")}>Authenticate test payment</button>}
        <button type="button" className={secondary} disabled={busy} onClick={() => onRecover(intentId, "verify_payment")}>Check payment status</button>
        {cancellationAvailable && <button type="button" className={secondary} disabled={busy} onClick={() => onRecover(intentId, "cancel_payment")}>Cancel unpaid test payment</button>}
      </div>}
    </section>
  );
}

async function call<T>(organizationId: string, signal: AbortSignal, command?: object): Promise<T> {
  const response = await fetch("/api/billing/automatic-top-up", {
    signal, credentials: "same-origin", cache: "no-store",
    ...(command ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...command, organizationId }) } : {}),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok !== true || payload.data?.organizationId !== organizationId) throw new Error("setup_unverified");
  return payload.data as T;
}
