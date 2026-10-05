"use client";

/**
 * /dashboard/settings/notifications — per-tenant notification config.
 *
 * Lets the operator paste their Slack incoming-webhook URL, Teams
 * connector URL, and an email digest recipient — values stored on
 * Lead.fullPayload.notifications via the preferences endpoint. The
 * scan-complete notifier reads these before falling back to the
 * platform-level env vars (wiring lands in a separate commit; this
 * page is the configuration surface).
 *
 * Calm-rule styling: zinc by default, emerald only on the saved
 * confirmation, rose on an error. No celebratory motion.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type Severity = "info" | "low" | "medium" | "high" | "critical";

interface Preferences {
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  emailDigestTo: string | null;
  severityFloor: Severity;
}

const FLOOR_OPTIONS: ReadonlyArray<{ value: Severity; label: string; hint: string }> = [
  { value: "info",     label: "Everything",   hint: "Even clean scans send a heartbeat ping." },
  { value: "low",      label: "Low and above", hint: "Quiet on info-only scans." },
  { value: "medium",   label: "Medium and above", hint: "The default — useful signals only." },
  { value: "high",     label: "High and above", hint: "Loud only when something needs attention." },
  { value: "critical", label: "Critical only",  hint: "Page-quality — almost never sends." },
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [phase, setPhase] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          setPrefs(data.preferences as Preferences);
          setPhase("idle");
        } else {
          setError(data?.hint ?? "Could not load preferences.");
          setPhase("error");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });
  }, []);

  async function save(next: Preferences) {
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.hint ?? data?.error ?? "Save failed.");
        setPhase("error");
        return;
      }
      setPrefs(data.preferences as Preferences);
      setPhase("saved");
      setTimeout(() => setPhase("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "error" && !prefs) {
    return (
      <div role="alert" aria-live="assertive" className="max-w-2xl mx-auto px-1 -mt-2 py-12 text-center text-[13px] text-rose-300">
        {error ?? "Could not load preferences."}
      </div>
    );
  }

  if (phase === "loading" || !prefs) {
    return (
      <div className="max-w-2xl mx-auto px-1 -mt-2 py-12 text-center">
        <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-1 -mt-2">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Dashboard
      </Link>

      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">notifications</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3">
          Where to ping you.
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Configure one or more channels. Every scan completion sends a single
          notification to all configured channels at or above your severity floor.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(prefs);
        }}
        className="space-y-8"
      >
        <Field
          label="Slack incoming webhook"
          hint="From a Slack app · Incoming Webhooks · Add New Webhook to Workspace. Looks like https://hooks.slack.com/services/T…/B…/…"
          value={prefs.slackWebhookUrl ?? ""}
          onChange={(v) => setPrefs({ ...prefs, slackWebhookUrl: v || null })}
          placeholder="https://hooks.slack.com/services/T0000/B0000/XXXX"
          type="url"
        />
        <Field
          label="Microsoft Teams connector URL"
          hint="From a Teams channel · Connectors · Incoming Webhook. Looks like https://….office.com/webhook/…"
          value={prefs.teamsWebhookUrl ?? ""}
          onChange={(v) => setPrefs({ ...prefs, teamsWebhookUrl: v || null })}
          placeholder="https://your-tenant.webhook.office.com/webhookb2/…"
          type="url"
        />
        <Field
          label="Email digest"
          hint="One recipient address. Receives the same summary the chat channels get."
          value={prefs.emailDigestTo ?? ""}
          onChange={(v) => setPrefs({ ...prefs, emailDigestTo: v || null })}
          placeholder="alerts@your-company.com"
          type="email"
        />

        <div>
          <p className="text-[13px] font-medium text-white mb-1.5">Severity floor</p>
          <p className="text-[11px] text-zinc-500 mb-3">
            Scans below this severity don&apos;t send. Findings still land in the dashboard either way.
          </p>
          <div className="space-y-1.5">
            {FLOOR_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors cursor-pointer ${
                  prefs.severityFloor === opt.value
                    ? "border-white/[0.18] bg-white/[0.025]"
                    : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12]"
                }`}
              >
                <input
                  type="radio"
                  name="severityFloor"
                  value={opt.value}
                  checked={prefs.severityFloor === opt.value}
                  onChange={() => setPrefs({ ...prefs, severityFloor: opt.value })}
                  className="mt-1 accent-zinc-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white">{opt.label}</p>
                  <p className="text-[11px] text-zinc-500">{opt.hint}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={phase === "saving"}
            className="inline-flex items-center gap-2 rounded-full bg-white text-zinc-950 px-5 py-2.5 text-[13px] font-medium hover:bg-zinc-100 disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            {phase === "saving" ? "Saving…" : "Save preferences"}
          </button>
          {phase === "saved" && <span role="status" aria-live="polite" className="text-[12px] text-emerald-300">Saved.</span>}
          {phase === "error" && error && <span role="alert" aria-live="assertive" className="text-[12px] text-rose-300">{error}</span>}
        </div>
      </form>

      <p className="mt-12 text-[11px] text-zinc-600 leading-relaxed">
        Today: platform-level env vars take precedence over per-tenant URLs.
        Per-tenant routing lands in a follow-up commit — this page is the
        configuration surface ahead of that wiring.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type: "url" | "email";
}) {
  const fieldId = `notif-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div>
      <label htmlFor={fieldId} className="block text-[13px] font-medium text-white mb-1.5">{label}</label>
      <p className="text-[11px] text-zinc-500 mb-2">{hint}</p>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/[0.18] transition-colors"
      />
    </div>
  );
}
