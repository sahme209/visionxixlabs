"use client";

import { FormEvent, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Footer } from "@/components/Footer";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name")?.toString() || "",
          email: formData.get("email")?.toString() || "",
          company: formData.get("company")?.toString() || "",
          message: formData.get("message")?.toString() || "",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitted(true);
      formRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-15 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 right-0 w-96 h-96 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-0 -left-40 w-96 h-96 rounded-full bg-fuchsia-600/5 blur-[120px] animate-pulse pointer-events-none" aria-hidden />
      {/* Extra floating orb */}
      <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-violet-500/[0.04] blur-[100px] pointer-events-none" aria-hidden />
      <Navigation />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 pb-24 relative">
        <Reveal direction="up" blur delay={0.05}>
          <div className="mb-12">
            <p className="huly-badge text-sm font-semibold text-violet-400 mb-3 tracking-wide uppercase">
              Contact
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 tracking-[-0.04em] leading-[1.05]">
              Get in touch.<br className="hidden sm:block" />
              <span className="text-zinc-500">We respond fast.</span>
            </h1>
            <p className="text-zinc-400 max-w-lg">
              Questions about Axiom, enterprise plans, or how autonomous cloud operations works for your infrastructure? We respond within one business day.
            </p>
          </div>
        </Reveal>

        {submitted ? (
          <Reveal direction="up" blur delay={0.1}>
            <div className="glass-card rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Message sent</p>
                  <p className="text-sm text-zinc-400">
                    We&apos;ve received your message and will get back to you soon.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        ) : (
          <Reveal direction="up" blur delay={0.15}>
            <form ref={formRef} onSubmit={handleSubmit} className="glass-card rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-5 animated-border card-inner-glow">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="floating-label-group">
                  <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white focus:outline-none transition-all duration-300 placeholder:text-zinc-600"
                  />
                </div>
                <div className="floating-label-group">
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Work email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white focus:outline-none transition-all duration-300 placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div className="floating-label-group">
                <label htmlFor="company" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white focus:outline-none transition-all duration-300 placeholder:text-zinc-600"
                />
              </div>
              <div className="floating-label-group">
                <label htmlFor="message" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  How can we help?
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white focus:outline-none transition-all duration-300 resize-none placeholder:text-zinc-600"
                  placeholder="Tell us about your cloud environment and what you're looking for."
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-huly btn-shimmer inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-900 hover:bg-zinc-100 transition-all disabled:opacity-50 shadow-lg shadow-white/10"
                >
                  {loading ? "Sending..." : "Send Message"}
                  {!loading && <ArrowRightIcon className="h-4 w-4" />}
                </button>
                <span className="response-time-badge">
                  <span className="response-dot" />
                  Usually responds within 2 hours
                </span>
              </div>
            </form>
          </Reveal>
        )}

        <div className="section-divider my-12" />

        <Reveal direction="up" blur delay={0.2}>
          <div className="pt-4">
            <p className="text-sm text-zinc-500 mb-4">
              Ready to scan your infrastructure now?
            </p>
            <Link
              href="/operator/onboarding"
              className="inline-flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              Run Axiom — connect your AWS account in 5 minutes
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}
