import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthCompanionHeader } from "@/components/auth/AuthCompanionHeader";
import { AuthCompanionShell } from "@/components/auth/AuthCompanionShell";
import { currentContext } from "@/lib/auth/currentContext";

const TOPICS = {
  "getting-started": {
    title: "Getting started with Axiom Agent",
    intro: "Use the browser companion to establish identity, then use the installed Agent for the governed release workspace.",
    points: ["Sign in in the browser and return to this companion for account context.", "Install Axiom Agent from the download page for release operations and provider setup.", "Start each release with scope, a validation plan, and recovery context before requesting approval."],
  },
  "release-workflow": {
    title: "The governed release workflow",
    intro: "Axiom keeps each meaningful step distinct so a request never looks more complete than its evidence supports.",
    points: ["Collect selected repository and environment context in a release record.", "Record readiness, validation, and recovery evidence before human approval.", "Keep the approval decision and post-release health separate from a trigger or a plan."],
  },
  security: {
    title: "Security and permissions",
    intro: "The browser companion deliberately has a smaller authority boundary than the installed Agent.",
    points: ["A provider is not shown as connected until server-side validation succeeds.", "Connection setup is tenant-scoped, consented, and auditable.", "Browser settings cannot change roles, approvals, workspace membership, or provider credentials."],
  },
  troubleshooting: {
    title: "Troubleshooting Axiom Agent",
    intro: "Start with the narrowest safe check before changing an account, connection, or deployment workflow.",
    points: ["Confirm the installed Agent is the latest version for your computer architecture.", "If the Agent is running but hidden, select it from the Dock or its menu-bar icon to restore the window.", "For a connection issue, review its recorded state before repeating consent or sharing any credential."],
  },
} as const;

export const dynamic = "force-dynamic";

export default async function AccountHelpTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const context = await currentContext();
  if (!context.isAuthenticated || !context.email) redirect("/auth/signin?callbackUrl=/account/help");
  const { topic } = await params;
  const content = TOPICS[topic as keyof typeof TOPICS];
  if (!content) notFound();

  return (
    <AuthCompanionShell>
      <div className="mx-auto max-w-[1400px]">
        <AuthCompanionHeader email={context.email} />
        <article className="max-w-3xl py-14 sm:py-20">
          <Link href="/account/help" className="text-sm text-violet-300 transition hover:text-violet-200">← Help</Link>
          <p className="mt-10 text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom web companion · guide</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{content.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">{content.intro}</p>
          <ol className="mt-10 space-y-3">{content.points.map((point, index) => <li key={point} className="flex gap-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-5"><span className="text-xs text-violet-300">0{index + 1}</span><p className="text-sm leading-6 text-zinc-300">{point}</p></li>)}</ol>
        </article>
      </div>
    </AuthCompanionShell>
  );
}
