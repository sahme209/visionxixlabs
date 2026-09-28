import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { DeploymentRequestsView } from "./views/DeploymentRequestsView";
import { DocsView } from "./views/DocsView";
import { SettingsView } from "./views/SettingsView";
import { DesktopSignInView } from "./views/DesktopSignInView";
import { DesktopAccessRequiredView } from "./views/DesktopAccessRequiredView";
import { desktopClient, type VerifiedDesktopIdentity } from "./lib/desktopClient";
import { clearApiKey } from "./lib/apiKeyStore";
import { clearAuthSession } from "./lib/authSession";

/**
 * Source-level identifiers remain broad so dormant requirement work can be
 * audited without deletion. Only the three imported/rendered customer views
 * below are reachable or included through the production App module.
 */
export type View =
  | "deployment-requests" | "docs" | "settings"
  | "start-here" | "dashboard" | "multi-cloud" | "security" | "scans"
  | "releases" | "sops" | "repositories" | "branch-validation" | "cherry-picks"
  | "release-freeze" | "change-tickets" | "policy-violations" | "release-readiness"
  | "release-overview" | "drift" | "applications" | "manual-fixes" | "release-audit"
  | "webhook-deliveries" | "branch-protection" | "release-notes" | "deployment-incidents"
  | "github-app" | "start-here-releaseops" | "release-advisor" | "policy-proposals"
  | "agi-cockpit" | "incident-triage" | "learning-loop" | "remediation-proposals"
  | "releaseops-autonomy" | "advisor-council" | "agi-memory" | "agi-suggestions"
  | "ai-call-log" | "activity" | "workflows" | "approvals" | "remediation"
  | "simulations" | "orchestration" | "handoffs" | "audit" | "connectors"
  | "connector-health" | "connector-setup" | "alert-escalations" | "slack-notifications"
  | "billing" | "trust";

export default function App() {
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "access_required" | "unauthenticated">("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<VerifiedDesktopIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function verifySavedCredential() {
      if (!desktopClient.hasAuth()) {
        if (!cancelled) setAuthState("unauthenticated");
        return;
      }

      const verified = await desktopClient.verifyCurrentCredential();
      if (cancelled) return;
      if (verified.ok) {
        setIdentity(verified.data);
        setAuthState(verified.data.access.allowed ? "authenticated" : "access_required");
        return;
      }

      await Promise.allSettled([clearApiKey(), clearAuthSession()]);
      if (cancelled) return;
      setAuthError(`Your saved sign-in could not be verified. ${verified.error}`);
      setAuthState("unauthenticated");
    }

    void verifySavedCredential();
    return () => { cancelled = true; };
  }, []);

  if (authState === "checking") return <BootScreen status="Verifying saved sign-in" />;
  if (authState === "unauthenticated") {
    return (
      <DesktopSignInView
        initialError={authError}
        onSignedIn={(verifiedIdentity) => {
          setAuthError(null);
          setIdentity(verifiedIdentity);
          setAuthState(verifiedIdentity.access.allowed ? "authenticated" : "access_required");
        }}
      />
    );
  }
  if (!identity) return <BootScreen status="Loading verified identity" />;
  if (authState === "access_required") {
    return (
      <DesktopAccessRequiredView
        identity={identity}
        onAccessGranted={(verifiedIdentity) => {
          setIdentity(verifiedIdentity);
          setAuthState("authenticated");
        }}
        onSignedOut={() => {
          setIdentity(null);
          setAuthError(null);
          setAuthState("unauthenticated");
        }}
      />
    );
  }
  return <AuthenticatedWorkspace identity={identity} />;
}

function AuthenticatedWorkspace({ identity }: { identity: VerifiedDesktopIdentity }) {
  const [activeView, setActiveView] = useState<View>("deployment-requests");
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 250);
    return () => clearTimeout(timer);
  }, []);

  if (!booted) return <BootScreen status="Loading deployment workspace" />;

  return (
    <div className="flex h-screen bg-axiom-bg text-white overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar activeView={activeView} identity={identity} />
        <div className="flex-1 min-h-0 flex flex-col">
          {activeView === "deployment-requests" && <DeploymentRequestsView />}
          {activeView === "docs" && <DocsView />}
          {activeView === "settings" && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

function BootScreen({ status }: { status: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-axiom-bg text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-violet-500/[0.10] blur-[160px] animate-pulse" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-2xl font-bold shadow-[0_0_60px_rgba(139,92,246,0.5)]">A</div>
        <p className="mt-6 text-base font-semibold tracking-tight text-white">Axiom Agent</p>
        <p className="mt-2 text-[10px] font-mono text-zinc-500 tracking-[0.22em] uppercase">{status}</p>
        <div className="mt-6 w-48 h-[2px] bg-zinc-800/70 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500 animate-[boot-bar_1s_ease-in-out_infinite]" />
        </div>
      </div>
      <style>{`@keyframes boot-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
}
