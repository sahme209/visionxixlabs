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
import { useState, type FormEvent } from "react";

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

function initialForm(intent?: "production-access"): FormState {
  return {
    name: "",
    email: "",
    topic: "product",
    message: intent === "production-access"
      ? "I need help with production access for our Axiom Agent workspace."
      : "",
    website: "",
  };
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; referenceId: string; delivery: "sent" | "failed" | "not_configured" }
  | { kind: "error"; message: string };

export function ContactClient({ intent }: { intent?: "production-access" }) {
  const [form, setForm] = useState<FormState>(() => initialForm(intent));
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setState({ kind: "error", message: "Name, email, and message are required." });
      return;
    }
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: intent === "production-access" ? "axiom-production-access" : "marketing-contact" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Send failed. Try again in a minute.");
      }
      const data = await res.json();
      setState({
        kind: "ok",
        referenceId: String(data.referenceId ?? "unavailable"),
        delivery: data.delivery === "sent" || data.delivery === "failed" ? data.delivery : "not_configured",
      });
      setForm(initialForm(intent));
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Send failed.",
      });
    }
  }

  return (
    <div className="relative">
      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pt-24 pb-8">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-[#ff783d] tabular-nums">Support</span>
          <span className="h-px w-6 bg-[#f54e00]/60" />
          A recovery path when you need it
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-5xl font-bold leading-[1.04]"
        >
          Help when self-service isn&apos;t enough.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          Documentation and in-product recovery should solve supported workflows first. For a genuine product, account, download, or security issue, send it here or email{" "}
          <a href="mailto:support@visionxixlabs.com" className="text-orange-300 hover:text-orange-200 underline underline-offset-4">support@visionxixlabs.com</a>.
        </motion.p>
      </section>

      {/* ===== FORM ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pb-16">
        <AnimatePresence mode="wait">
          {state.kind === "ok" ? (
            <motion.div
              key="ok"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6"
            >
              <p className="text-[12px] font-mono uppercase tracking-widest text-emerald-300">
                request recorded
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Your message was durably accepted.
              </h2>
              <p className="mt-2 text-[14px] text-zinc-300 leading-relaxed">
                Reference <span className="font-mono text-white">{state.referenceId}</span>. Email delivery status: {state.delivery.replace("_", " ")}.
                No response-time or support entitlement is implied.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href="/#capabilities"
                  className="inline-flex items-center gap-2 rounded-full bg-[#f54e00] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#ff641f] transition"
                >
                  Review capabilities
                </Link>
                <Link
                  href="/plans"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
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
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8 space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" htmlFor="name">
                  <input
                    id="name"
                    type="text"
                    required
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
                    autoComplete="email"
                    value={form.email}
                    maxLength={240}
                    onChange={(e) => update("email", e.target.value)}
                    className="form-input"
                  />
                </Field>
              </div>

              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  What&apos;s the reason?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => update("topic", t.id)}
                      className={[
                        "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition border",
                        form.topic === t.id
                          ? "bg-zinc-500/15 border-zinc-500/40 text-zinc-200"
                          : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05]",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-zinc-500">
                  {TOPICS.find((t) => t.id === form.topic)?.hint}
                </p>
              </div>

              <Field label="What went wrong?" htmlFor="message">
                <textarea
                  id="message"
                  rows={4}
                  required
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
                <div role="alert" aria-live="assertive" className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">
                  {state.message}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={state.kind === "submitting"}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f54e00] px-5 py-2.5 text-[13px] font-medium text-white hover:bg-[#ff641f] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state.kind === "submitting" ? "Sending…" : "Send →"}
                </button>
                <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                  sent through the contact endpoint
                </span>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      <style>{`
        .form-input {
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
        .form-input::placeholder { color: rgba(161,161,170,0.6); }
        .form-input:focus {
          border-color: rgba(245,78,0,0.6);
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
      <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
