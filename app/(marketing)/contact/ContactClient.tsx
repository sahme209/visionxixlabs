"use client";

/**
 * /contact — support and account escalation.
 *
 * Submits to /api/contact (existing handler). The form mirrors the
 * The supported journey stays self-service. This form is the recovery path
 * for a real product, account, download, security, or press issue.
 */

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { PageHero } from "@/components/marketing/PageHero";

type Topic = "product" | "download" | "security" | "support" | "press";

const TOPICS: ReadonlyArray<{ id: Topic; label: string; hint: string }> = [
  { id: "product",    label: "Product question",   hint: "Ask how the installed application supports your deployment workflow." },
  { id: "download",   label: "Download help",      hint: "Installer, platform, signing, or first-launch assistance." },
  { id: "security",   label: "Security",           hint: "Ask about implemented controls, data handling, or connector setup." },
  { id: "support",    label: "Support",            hint: "Help with an existing installation or account." },
  { id: "press",      label: "Press / partners",   hint: "Coverage, integration, or partnership." },
];

interface FormState {
  name: string;
  email: string;
  topic: Topic;
  message: string;
  website: string;
}

type ContactIntent = "production-access" | "ask-axiom" | "security";
function initialForm(intent?: ContactIntent, prefill?: string): FormState {
  return {
    name: "",
    email: "",
    topic: intent === "security" ? "security" : "product",
    message: intent === "production-access"
      ? "I need help with production access for our V19 workspace."
      : intent === "ask-axiom" && prefill
        ? `Ask V19 couldn't answer this:\n\n${prefill}\n\n`
        : "",
    website: "",
  };
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; referenceId: string; delivery: "sent" | "failed" | "not_configured" }
  | { kind: "error"; message: string };

export function ContactClient({ intent, prefill }: { intent?: ContactIntent; prefill?: string }) {
  const [form, setForm] = useState<FormState>(() => initialForm(intent, prefill));
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const submitted = useRef(false);
  const focusReceipt = useCallback((heading: HTMLHeadingElement | null) => {
    heading?.focus();
  }, []);
  const submitting = state.kind === "submitting";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitted.current) return;
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setState({ kind: "error", message: "Name, email, and message are required." });
      return;
    }
    submitted.current = true;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: intent === "production-access" ? "axiom-production-access" : intent === "ask-axiom" ? "ask-axiom" : "marketing-contact" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Send failed. Try again in a minute.");
      }
      const data = await res.json();
      if (data?.accepted !== true || typeof data?.referenceId !== "string" || !data.referenceId.trim()) {
        throw new Error("We could not confirm that your message was recorded. Your message is still here; keep a copy and contact support before sending it again.");
      }
      setState({
        kind: "ok",
        referenceId: data.referenceId,
        delivery: data.delivery === "sent" || data.delivery === "failed" ? data.delivery : "not_configured",
      });
    } catch (err) {
      submitted.current = false;
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Send failed.",
      });
    }
  }

  return (
    <div className="public-contact-page">
      {/* ===== HERO ===== */}
      <section className="public-contact-header">
        <PageHero eyebrow="Support · A recovery path when you need it" title="Help when self-service isn't enough." lead={<>
          Documentation and in-product recovery should solve supported workflows first. For a genuine product, account, download, or security issue, send it here or email{" "}
          <a href="mailto:support@visionxixlabs.com" className="text-zinc-200 hover:text-white underline underline-offset-4">support@visionxixlabs.com</a>.
        </>} />
      </section>

      {/* ===== FORM ===== */}
      <section className="public-contact-body" aria-label="Contact support">
        <div className="min-w-0">
        <AnimatePresence mode="wait">
          {state.kind === "ok" ? (
            <motion.div
              key="ok"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="public-contact-result rounded-2xl border border-emerald-500/30 bg-emerald-500/6 p-6"
            >
              <p className="text-[12px] font-mono uppercase tracking-widest text-emerald-300">
                request recorded
              </p>
              <h2 ref={focusReceipt} tabIndex={-1} className="mt-2 text-xl font-semibold text-white">
                Your message was durably accepted.
              </h2>
              <p className="mt-2 text-[14px] text-zinc-300 leading-relaxed">
                Reference <span className="font-mono text-white">{state.referenceId}</span>. Email delivery status: {state.delivery.replace("_", " ")}.
                No response-time or support entitlement is implied.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href="/product"
                  className="public-contact-primary"
                >
                  Review capabilities
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/3 px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
                >
                  See plans
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="public-contact-form space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" htmlFor="name">
                  <input
                    id="name"
                    type="text"
                    required
                    readOnly={submitting}
                    autoComplete="name"
                    value={form.name}
                    maxLength={240}
                    onChange={(e) => update("name", e.target.value)}
                    className="form-input"
                  />
                </Field>
                <Field label="Work email" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    required
                    readOnly={submitting}
                    autoComplete="email"
                    value={form.email}
                    maxLength={240}
                    onChange={(e) => update("email", e.target.value)}
                    className="form-input"
                  />
                </Field>
              </div>

              <fieldset className="public-contact-topics">
                <legend className="text-xs text-zinc-400 mb-3">
                  What&apos;s the reason?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => update("topic", t.id)}
                      aria-pressed={form.topic === t.id}
                      className={[
                        "min-h-11 rounded-lg px-3.5 py-2 text-[13px] font-medium transition border",
                        form.topic === t.id
                          ? "bg-zinc-500/15 border-zinc-500/40 text-zinc-200"
                          : "bg-white/2 border-white/6 text-zinc-400 hover:text-white hover:bg-white/5",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-zinc-400">
                  {TOPICS.find((t) => t.id === form.topic)?.hint}
                </p>
              </fieldset>

              <Field label="What went wrong?" htmlFor="message">
                <textarea
                  id="message"
                  rows={4}
                  required
                  readOnly={submitting}
                  value={form.message}
                  maxLength={8000}
                  onChange={(e) => update("message", e.target.value)}
                  className="form-input resize-none"
                  placeholder="Tell us the step you were on, what you expected, and the error or behavior you saw. Never include a password, token, or cloud secret."
                />
              </Field>

              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update("website", event.target.value)} />
              </div>

              {state.kind === "error" ? (
                <div role="alert" aria-live="assertive" className="rounded-xl border border-red-500/30 bg-red-500/6 px-4 py-3 text-[13px] text-red-300">
                  {state.message}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  aria-disabled={submitting}
                  className="public-contact-primary aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                >
                  {submitting ? "Sending…" : "Send →"}
                </button>
                <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
                  sent through the contact endpoint
                </span>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        </div>
        <aside className="public-contact-help" aria-labelledby="contact-context">
          <p className="public-feature-eyebrow">A useful starting point</p>
          <h2 id="contact-context">Keep the context.<br /><span>Leave out secrets.</span></h2>
          <p>Include your app version, the step you reached, and the error or behavior you saw.</p>
          <p>Never include a password, token, or cloud secret.</p>
          <div className="public-contact-guide-links">
            <Link href="/docs">Browse the documentation <span aria-hidden="true">↗</span></Link>
            <Link href="/download">Check installation help <span aria-hidden="true">↗</span></Link>
            <Link href="/docs/security-model">Read the security model <span aria-hidden="true">↗</span></Link>
          </div>
        </aside>
      </section>

      <style>{`
        .public-contact-page .form-input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: rgb(244,244,245);
          font-size: 13.5px;
          padding: 10px 12px;
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .public-contact-page .form-input::placeholder { color: rgb(133,133,133); }
        .public-contact-page .form-input:focus {
          border-color: rgba(191,189,182,0.65);
          background: rgba(255,255,255,0.04);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
