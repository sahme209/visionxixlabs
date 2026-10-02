"use client";

/**
 * /dashboard/github-app — Phase 502.
 *
 * Zero-touch entry point: one-click install of the Axiom GitHub App
 * on the user's org. After install, GitHub redirects to our callback,
 * which captures the installation_id and surfaces here as a
 * "Connected" banner.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { PageIntro } from "@/components/dashboard/PageIntro";

interface InstallationView {
  id: string;
  githubInstallationId: string;
  accountLogin: string;
  accountType: "User" | "Organization" | "unknown";
  repositorySelection: "all" | "selected" | "unknown";
  status: "active" | "suspended" | "revoked" | "unknown";
  installedAtIso: string;
  suspendedAtIso: string | null;
  revokedAtIso: string | null;
}

interface StatusData {
  generatedAt: string;
  installed: boolean;
  active: InstallationView | null;
  history: InstallationView[];
  installReady: boolean;
}

type StatusBody =
  | { ok: true; data: StatusData }
  | { ok: false; error: string; hint?: string };

const STATUS_CLASS: Record<InstallationView["status"], string> = {
  active:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  suspended: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  revoked:   "bg-rose-500/15 text-rose-300 border-rose-500/25",
  unknown:   "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export default function GitHubAppPage() {
  const params = useSearchParams();
  const [resp, setResp] = useState<StatusBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingInstall, setOpeningInstall] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadStatus() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/github-installation-status", { credentials: "include" })
      .then((r) => r.json())
      .then((j: StatusBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadStatus(); }, []);

  async function beginInstall() {
    setOpeningInstall(true);
    setNetworkError(null);
    try {
      const response = await fetch("/api/dashboard/github-installation-start", {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json() as { ok: boolean; data?: { installUrl?: string } };
      if (!body.ok || !body.data?.installUrl) throw new Error("GitHub installation is not available yet.");
      window.location.assign(body.data.installUrl);
    } catch (error) {
      setNetworkError(error instanceof Error ? error.message : "Could not start GitHub installation.");
      setOpeningInstall(false);
    }
  }

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;
  const callbackParam = params.get("install");
  const requestParam = params.get("install_request");
  const installError = params.get("install_error");

  return (
    <div className="relative">
      <PageIntro
        kicker={`ReleaseOps · GitHub App${data?.installed ? ` · connected as ${data.active?.accountLogin}` : ""}`}
        title={<>Connect once. <span className="text-zinc-500">Review before each release.</span></>}
        description="Install the Axiom GitHub App on only the repositories you select. Axiom uses read-only evidence to assemble release context; it does not deploy, change code, or expose a GitHub token."
        helps="This connection is the trusted source for pull requests, checks, workflows, and repository protections used in release review."
        connectFirst="You need admin rights on the GitHub org to authorize the install. If you don't, click the link anyway — GitHub will route a request to the org admins on your behalf."
        engineers={["DevOps", "Release Captain", "Security"]}
        requiresApproval="GitHub may require org-admin approval depending on your org's app-install policy."
        actions={[
          { label: "Repositories",       href: "/dashboard/repositories" },
          { label: "Webhook deliveries", href: "/dashboard/webhook-deliveries" },
        ]}
        safetyNote="Per-org isolation · idempotent on (org, installation_id) · suspended installs can be reactivated"
      />

      {callbackParam === "ok" && (
        <div className="mb-6 rounded-2xl border border-emerald-500/[0.18] bg-emerald-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircleIcon className="h-4 w-4 text-emerald-300" />
            <p className="text-[13px] font-semibold text-emerald-200">GitHub App installed</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">The platform will now auto-process incoming webhook deliveries from this installation.</p>
        </div>
      )}

      {callbackParam === "error" && (
        <div className="mb-6 rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
          Install failed to land. Try the install link again, or contact us if the issue persists.
        </div>
      )}

      {requestParam === "1" && (
        <div className="mb-6 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 text-[13px] text-zinc-300">
          Your install request was sent to your GitHub org admin. They need to approve before the platform can connect.
        </div>
      )}

      {installError && (
        <div className="mb-6 rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 text-[13px] text-zinc-300">
          {installError === "missing_installation_id" && "GitHub didn't send us an installation id — try the install link again."}
          {installError === "no_org_in_state" && "We couldn't associate the install with your workspace. Try again from this page."}
          {installError !== "missing_installation_id" && installError !== "no_org_in_state" && `Install error: ${installError}`}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6 text-[12px] text-zinc-400">
          Loading installation status…
        </div>
      )}

      {!loading && networkError && (
        <div className="rounded-2xl border border-rose-500/[0.18] bg-rose-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {networkError}
        </div>
      )}

      {!loading && errorBody?.error === "migration_pending" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ExclamationTriangleIcon className="h-4 w-4 text-amber-300" />
            <p className="text-[12px] font-semibold text-amber-200">Schema migration pending</p>
          </div>
          <p className="text-[12.5px] text-zinc-300">{errorBody.hint}</p>
        </div>
      )}

      {!loading && errorBody?.error === "auth_required" && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          Sign in required.
        </div>
      )}

      {data && (
        <>
          {data.installReady ? (
            <div className="mb-6 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
              <p className="text-[13px] font-semibold text-violet-100 mb-2">
                {data.installed ? "Re-install or extend repository selection" : "Install Axiom on your GitHub org"}
              </p>
              <button
                type="button"
                onClick={() => { void beginInstall(); }}
                disabled={openingInstall}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-500/40 bg-violet-500/[0.12] text-[13px] font-semibold text-violet-100 hover:bg-violet-500/[0.20] transition-colors"
              >
                <span>{openingInstall ? "Opening GitHub…" : "Continue to GitHub"}</span>
              </button>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 text-[12.5px] text-zinc-300">
              <p className="font-semibold text-amber-200 mb-1">Install URL not yet configured</p>
              <p>Set <code className="font-mono text-zinc-100">GITHUB_APP_SLUG</code> in the deploy environment to enable the one-click install link.</p>
            </div>
          )}

          {data.installed && data.active && (
            <div className="mb-6 rounded-2xl border border-emerald-500/[0.18] bg-emerald-500/[0.03] p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[data.active.status]}`}>
                  {data.active.status}
                </span>
                <p className="text-[13px] font-semibold text-emerald-100">{data.active.accountLogin}</p>
                <span className="text-[10px] font-mono text-zinc-500">type: {data.active.accountType}</span>
                <span className="text-[10px] font-mono text-zinc-500">scope: {data.active.repositorySelection}</span>
                <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                  installed {new Date(data.active.installedAtIso).toLocaleString()}
                </span>
              </div>
              <p className="text-[11.5px] font-mono text-zinc-500">installation_id: {data.active.githubInstallationId}</p>
            </div>
          )}

          {data.history.length > 0 && (
            <>
              <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">History</h3>
              <div className="space-y-2 mb-8">
                {data.history.map((h) => (
                  <div key={h.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[h.status]}`}>
                        {h.status}
                      </span>
                      <span className="text-[12px] text-white">{h.accountLogin}</span>
                      <span className="text-[10px] font-mono text-zinc-500">id {h.githubInstallationId}</span>
                      <span className="text-[10px] font-mono text-zinc-500 ml-auto">
                        installed {new Date(h.installedAtIso).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
