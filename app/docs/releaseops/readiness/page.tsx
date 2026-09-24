import type { Metadata } from "next";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "Readiness checks — ReleaseOps Documentation",
    description: "How Axiom Agent records deployment readiness signals, uncertainty, evidence, and approval gates.",
};

const DIMENSIONS = [
    ["Ownership and scope", "Service owner, environment, change scope, customer impact, and accountable approvers."],
    ["Repository and pipeline state", "Branch protection, required checks, release artifact, and connector evidence when available."],
    ["Dependencies and scheduling", "Upstream or downstream dependencies, blackout windows, sequence, and collision checks."],
    ["Access and separation of duties", "Required permissions, role boundaries, and independent approval rules."],
    ["Validation plan", "Expected outcomes, probes, owners, thresholds, and deferred-validation rules."],
    ["Rollback readiness", "A documented recovery path, decision owner, trigger, and evidence that applies to this change."],
    ["Communication", "Stakeholders, channels, change record, escalation, and delivery status."],
    ["Evidence and closure", "Artifacts and observations required before the request can close."],
] as const;

export default function ReadinessScoringPage() {
    return (
        <>
            <DocHeader
                kicker="ReleaseOps · Readiness"
                title="Deployment readiness."
                summary="Axiom Agent assembles evidence-backed readiness checks before approval and execution. It must distinguish verified signals, missing data, preview inputs, and human judgments."
            />

            <Callout variant="info" title="A score is not evidence by itself">
                Any summary or score must be traceable to its source inputs. Missing connectors stay unknown, not green. Organizations configure their own gates; this documentation does not promise a universal numeric threshold.
            </Callout>

            <DocSection id="dimensions" title="Readiness dimensions" kicker="01">
                <div className="space-y-3">
                    {DIMENSIONS.map(([name, detail]) => (
                        <div key={name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <p className="text-sm font-bold text-white mb-1.5">{name}</p>
                            <p className="text-xs text-zinc-400 leading-relaxed">{detail}</p>
                        </div>
                    ))}
                </div>
            </DocSection>

            <DocSection id="states" title="Required signal states" kicker="02">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li><strong>Verified</strong> — supported by a current persisted record or actual integration response.</li>
                    <li><strong>Human confirmed</strong> — explicitly attested by an authorized user with time and identity recorded.</li>
                    <li><strong>Preview</strong> — derived from sample or non-live logic and never treated as production evidence.</li>
                    <li><strong>Unknown</strong> — no current evidence; cannot silently pass a gate.</li>
                    <li><strong>Failed or blocked</strong> — the check ran and did not satisfy policy, or a required dependency is unavailable.</li>
                </ul>
            </DocSection>

            <DocSection id="gates" title="How gates behave" kicker="03">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Blocking requirements stop progression and identify the owner or dependency needed to continue.</li>
                    <li>Rejected and expired approvals remain recorded and do not count as authorization.</li>
                    <li>Retries preserve prior attempts and their evidence.</li>
                    <li>Deferred validation records an owner, due time, expected check, and follow-up state.</li>
                    <li>Closure is unavailable until required evidence and validation are present.</li>
                </ul>
            </DocSection>

            <DocSection id="trust" title="Trust questions" kicker="04">
                <TrustGrid
                    items={[
                        { question: "What is readiness?", answer: "A set of policy checks and evidence used to decide whether a specific deployment can proceed." },
                        { question: "Does missing data pass?", answer: "No. It remains unknown or blocked according to policy." },
                        { question: "Can AI decide alone?", answer: "No. AI output carries sources and uncertainty; required human approvals remain authoritative." },
                        { question: "Can thresholds vary?", answer: "Yes. Organizations and environments can use different gates, provided the active policy is recorded." },
                        { question: "What happens after a failure?", answer: "The failed result and evidence remain visible; correct the dependency and rerun only the affected check." },
                        { question: "Where is readiness reviewed?", answer: "Inside the installed Axiom Agent deployment workflow." },
                    ]}
                />
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
                next={{ href: "/docs/desktop-install", label: "Install the desktop app" }}
            />
            <DocFeedback />
        </>
    );
}
