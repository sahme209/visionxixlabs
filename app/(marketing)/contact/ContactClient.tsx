"use client";

/**
 * /contact — Axiom-flavored lead capture.
 *
 * Submits to /api/contact (existing handler). The form mirrors the
 * questions a serious buyer answers in the first call: company,
 * cloud surface, primary concern, ideal start. Closed-union selects
 * keep the payload predictable for downstream tagging.
 */

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useState, type FormEvent } from "react";

type Topic = "demo" | "trial" | "enterprise" | "support" | "press";
type CloudProvider = "aws" | "azure" | "gcp" | "multi" | "none";
type CompanySize = "1-10" | "11-50" | "51-200" | "201-1k" | "1k+";

const TOPICS: ReadonlyArray<{ id: Topic; label: string; hint: string }> = [
  { id: "demo",       label: "Book a walkthrough", hint: "Review the web product and its current sandbox boundary." },
  { id: "trial",      label: "Product access",     hint: "Ask about a tenant workspace; no public trial terms are implied." },
  { id: "enterprise", label: "Production needs",   hint: "Discuss requirements, integrations, security, and procurement." },
  { id: "support",    label: "Support",            hint: "Existing operator with an account question." },
  { id: "press",      label: "Press / partners",   hint: "Coverage, integration, or partnership." },
];

const CLOUD_OPTIONS: ReadonlyArray<{ id: CloudProvider; label: string }> = [
  { id: "aws",   label: "AWS" },
  { id: "azure", label: "Azure" },
  { id: "gcp",   label: "GCP" },
  { id: "multi", label: "Multi-cloud" },
  { id: "none",  label: "Not yet on a cloud" },
];

const COMPANY_SIZE_OPTIONS: ReadonlyArray<{ id: CompanySize; label: string }> = [
  { id: "1-10",    label: "1–10" },
  { id: "11-50",   label: "11–50" },
  { id: "51-200",  label: "51–200" },
  { id: "201-1k",  label: "201–1 000" },
  { id: "1k+",     label: "1 000+" },
];

interface FormState {
  name: string;
  email: string;
  company: string;
  topic: Topic;
  cloudProvider: CloudProvider;
  companySize: CompanySize;
  message: string;
}

const INITIAL: FormState = {
  name: "",
  email: "",
  company: "",
  topic: "demo",
  cloudProvider: "aws",
  companySize: "11-50",
  message: "",
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function ContactClient() {
  const [form, setForm] = useState<FormState>(INITIAL);
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
        body: JSON.stringify({ ...form, source: "marketing-contact" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Send failed. Try again in a minute.");
      }
      setState({ kind: "ok" });
      setForm(INITIAL);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Send failed.",
      });
    }
  }

  return (
    <div className="relative">
      {/* Huly aurora — coral × violet × cyan */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-1/4 left-1/4 h-[60vh] w-[50vw] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="ambient-drift absolute top-[15%] right-[5%] h-[50vh] w-[40vw] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute bottom-[10%] left-[5%] h-[40vh] w-[35vw] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pt-24 pb-8">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">CT</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          One operator · one form
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-5xl font-bold leading-[1.04]"
        >
          Get the{" "}
          <span className="relative inline-block">
            walkthrough.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          Tell us about the deployment workflow you need to govern. We will
          respond with the relevant web access, integration, and sandbox details.
        </motion.p>
      </section>

      {/* ===== FORM ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 pb-16">
        <AnimatePresence mode="wait">
          {state.kind === "ok" ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6"
            >
              <p className="text-[12px] font-mono uppercase tracking-widest text-emerald-300">
                message sent
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Message received.
              </h2>
              <p className="mt-2 text-[14px] text-zinc-300 leading-relaxed">
                Your message was accepted by the contact endpoint. We will use
                the email address you supplied to respond.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  href="/#capabilities"
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
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
                    onChange={(e) => update("email", e.target.value)}
                    className="form-input"
                  />
                </Field>
              </div>

              <Field label="Company" htmlFor="company">
                <input
                  id="company"
                  type="text"
                  autoComplete="organization"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                  className="form-input"
                />
              </Field>

              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  What's the reason?
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
                          ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-200"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                    Cloud surface
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CLOUD_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => update("cloudProvider", o.id)}
                        className={[
                          "rounded-full px-3 py-1 text-[11.5px] font-medium transition border",
                          form.cloudProvider === o.id
                            ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                            : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white",
                        ].join(" ")}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                    Company size
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMPANY_SIZE_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => update("companySize", o.id)}
                        className={[
                          "rounded-full px-3 py-1 text-[11.5px] font-medium transition border",
                          form.companySize === o.id
                            ? "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200"
                            : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white",
                        ].join(" ")}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Field label="Anything else?" htmlFor="message">
                <textarea
                  id="message"
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  className="form-input resize-none"
                  placeholder="What's the operator surface you're trying to run? What proposals would you want staged first?"
                />
              </Field>

              {state.kind === "error" ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">
                  {state.message}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={state.kind === "submitting"}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
          border-color: rgba(99,102,241,0.6);
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
