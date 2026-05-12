"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CloudIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type ConnectorStatus = {
  provider: string;
  status: string;
  accountId?: string;
  lastScan?: string;
};

export default function DashboardPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/connectors/status")
      .then((r) => r.json())
      .then((data) => {
        setConnectors(data.connectors || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  const connected = connectors.filter((c) => c.status === "connected");

  return (
    <>
      <Reveal direction="up" blur delay={0.05}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-[-0.04em]">
            Axiom <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-zinc-400 mt-1">
            Manage your cloud connections, view scan results, and run operations.
          </p>
        </div>
      </Reveal>

      <Stagger delay={0.1} interval={0.06} className="grid sm:grid-cols-3 gap-4 mb-8">
        <Link
          href="/operator/onboarding"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <CloudIcon className="h-5 w-5 text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Connect Cloud</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Link your AWS, Azure, or GCP account with a read-only IAM role.
          </p>
        </Link>

        <Link
          href="/axiom/operations"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <BoltIcon className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Operations</h2>
          </div>
          <p className="text-xs text-zinc-500">
            View scan results, findings, execution plans, and audit trail.
          </p>
        </Link>

        <Link
          href="/dashboard/resilience"
          className="glass-card card-hover animated-border card-inner-glow rounded-xl p-5 group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-fuchsia-500/10 flex items-center justify-center">
              <ShieldCheckIcon className="h-5 w-5 text-fuchsia-400" />
            </div>
            <h2 className="text-sm font-semibold text-white">Resilience</h2>
          </div>
          <p className="text-xs text-zinc-500">
            Architecture analysis, Terraform generation, and deployment safety.
          </p>
        </Link>
      </Stagger>

      {/* Connected accounts */}
      <Reveal direction="up" blur delay={0.15}>
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 tracking-[-0.04em]">
            Connected accounts
          </h2>
          {connected.length === 0 ? (
            <div className="text-center py-8">
              <CloudIcon className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-4">No cloud accounts connected yet.</p>
              <Link
                href="/operator/onboarding"
                className="btn-huly inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-900 rounded-full text-sm font-semibold hover:bg-zinc-100 transition-all"
              >
                Connect your first account
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {connected.map((c) => (
                <div
                  key={c.accountId || c.provider}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{c.provider}</p>
                      {c.accountId && (
                        <p className="text-xs text-zinc-500">{c.accountId}</p>
                      )}
                    </div>
                  </div>
                  {c.lastScan && (
                    <span className="text-xs text-zinc-500">
                      Last scan: {new Date(c.lastScan).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      <div className="section-divider my-8" />

      <Reveal direction="up" blur delay={0.2}>
        <div className="glass-card card-hover rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2 tracking-[-0.04em]">
            Getting started
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-zinc-400">
            <li>Connect a cloud account with a read-only IAM role</li>
            <li>Run your first scan to discover infrastructure and findings</li>
            <li>Review execution plans and approve changes</li>
          </ol>
        </div>
      </Reveal>
    </>
  );
}
