import type { View } from "../App";
import { ViewShell } from "../components/Primitives";
import { OnboardingChecklist } from "../components/OnboardingChecklist";

/**
 * Phase 505 — desktop sibling of /dashboard/start-here-releaseops.
 * The single canonical orientation surface for a new tenant.
 */
export function StartHereReleaseOpsView({ onNavigate }: { onNavigate?: (v: View) => void } = {}) {
  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Start here — ReleaseOps</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Zero-touch path from sign-in to first audited release deployed.
        </p>
      </div>

      <OnboardingChecklist onNavigate={onNavigate} />

      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-white mb-3">The 4-step path</h2>
        <ol className="space-y-3">
          <Step num={1} title="Install the Axiom GitHub App" body="One click. The App's org-wide webhook delivery means no URL paste-in." view="github-app" onNavigate={onNavigate} cta="Open install page" />
          <Step num={2} title="Register your first application" body="Applications are the governance unit. Releases attach to an application." view="applications" onNavigate={onNavigate} cta="Register an application" />
          <Step num={3} title="Push to any tracked repo (auto-onboard)" body="After install, the first webhook for a repo auto-creates the Repository row." view="repositories" onNavigate={onNavigate} cta="Open repositories" />
          <Step num={4} title="Cut your first release" body="Pin a tag + commit + planned-window. Releases start in draft, advance through draft → ready → deploying → deployed." view="releases" onNavigate={onNavigate} cta="Create a release" />
        </ol>
      </div>

      <div className="glass-card p-4 border border-violet-500/20">
        <h2 className="text-sm font-semibold text-violet-100 mb-2">The cause → effect loop</h2>
        <p className="text-[12.5px] text-zinc-300 mb-3">
          Two surfaces close the post-deploy reconciliation loop:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <CauseEffectCard
            label="cause"
            title="Manual fixes"
            body="Engineer patched prod by hand. Logged here. Reconciled once a catch-up PR lands."
            view="manual-fixes"
            onNavigate={onNavigate}
          />
          <CauseEffectCard
            label="effect"
            title="Deployment incidents"
            body="Release caused a regression. open → mitigated → resolved | wont_fix."
            view="deployment-incidents"
            onNavigate={onNavigate}
          />
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-white mb-2">Audit + governance</h2>
        <p className="text-[12.5px] text-zinc-300 mb-3">
          Every state-changing endpoint best-effort appends to the audit log.
        </p>
        <div className="flex flex-wrap gap-2">
          <QuickLink view="release-audit" label="Release audit log" onNavigate={onNavigate} />
          <QuickLink view="policy-violations" label="Policy violations" onNavigate={onNavigate} />
          <QuickLink view="release-readiness" label="Release readiness" onNavigate={onNavigate} />
          <QuickLink view="branch-protection" label="Branch protection" onNavigate={onNavigate} />
          <QuickLink view="webhook-deliveries" label="Webhook deliveries" onNavigate={onNavigate} />
        </div>
      </div>

      <div className="glass-card p-4 border border-white/20">
        <h2 className="text-sm font-semibold text-zinc-200 mb-2">Honest gaps</h2>
        <ul className="space-y-1.5 text-[12.5px] text-zinc-300">
          <li><span className="font-mono text-zinc-300">Branch protection auto-sync</span> — paste-in JSON today; <code className="font-mono text-zinc-100">gh api</code> fetch lands with the App private key.</li>
          <li><span className="font-mono text-zinc-300">Installation-token repo discovery</span> — we capture the installation_id but don't yet call <code className="font-mono text-zinc-100">/installation/repositories</code>.</li>
          <li><span className="font-mono text-zinc-300">Slack notifications</span> — model + UI exist; outbound hop is a separate phase.</li>
        </ul>
      </div>
    </ViewShell>
  );
}

function Step({ num, title, body, view, cta, onNavigate }: {
  num: number; title: string; body: string; view: View; cta: string; onNavigate?: (v: View) => void;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-violet-500/[0.12] border border-violet-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[11px] font-mono font-semibold text-violet-200">{num}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-semibold text-white">{title}</p>
        <p className="text-[11.5px] text-zinc-400 mb-1">{body}</p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(view)}
            className="text-[11px] font-mono text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
          >
            {cta} →
          </button>
        )}
      </div>
    </li>
  );
}

function CauseEffectCard({ label, title, body, view, onNavigate }: {
  label: string; title: string; body: string; view: View; onNavigate?: (v: View) => void;
}) {
  return (
    <div className="rounded-md border border-zinc-700/40 bg-zinc-900/40 p-3">
      <p className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-[12.5px] font-semibold text-white mb-1">{title}</p>
      <p className="text-[11px] text-zinc-400 mb-1.5">{body}</p>
      {onNavigate && (
        <button
          type="button"
          onClick={() => onNavigate(view)}
          className="text-[11px] font-mono text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline"
        >
          Open →
        </button>
      )}
    </div>
  );
}

function QuickLink({ view, label, onNavigate }: { view: View; label: string; onNavigate?: (v: View) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(view)}
      className="px-3 py-1.5 rounded-md border border-zinc-700/40 bg-zinc-900/40 text-[12px] font-mono text-zinc-200 hover:border-violet-500/30 transition-colors"
    >
      {label}
    </button>
  );
}
