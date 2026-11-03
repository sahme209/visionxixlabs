import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, Step } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Source modes — Axiom Documentation",
  description: "Distinguish local repository files, connected GitHub evidence and preview data before using Axiom.",
};

export default function SourceModesPage() {
  return (
    <>
      <DocHeader kicker="Repository context · Source modes" title="Know which source you are using."
        summary="A file on your computer, a connected GitHub repository and a recorded result are different sources. Check the source and target before asking for an explanation or preparing a change." />

      <Callout title="Version and scope">
        This guide describes registered repository controls in the current local preview. Your installed version may differ. It does not establish production readiness, current provider access or complete Governance enforcement. GitLab connector or GitLab sign-in availability is not established by this guide.
      </Callout>

      <DocSection id="local-files" title="Local files on your computer" kicker="01 · Inspect a checkout">
        <p>In Repositories, the Local strip identifies the selected checkout and its branch. Open Clone or refresh repositories to inspect the source controls. The Local repositories folder lists the local checkouts Axiom can discover there; choose the intended repository before opening a file.</p>
        <p>The editor can contain unsaved changes. A local selection is not a verified GitHub snapshot, and a saved folder selection is navigation metadata, not permission to access a different repository or execute a command.</p>
        <Step number={1} title="Confirm the local target">
          <p>Check the folder, checkout, branch and changed-file count. Use Refresh after changing the folder. If the expected checkout is missing, inspect the folder rather than assuming the selected remote repository is already cloned.</p>
        </Step>
        <Step number={2} title="Keep drafts, saved files and checks separate">
          <p>Review an edit before Save. Saving a local file does not commit, push, open a pull request or deploy. A check receipt describes that check&apos;s recorded result; changed files can make it stale. Inspect the current file and result before relying on it.</p>
        </Step>
      </DocSection>

      <DocSection id="connected-github" title="Connected GitHub repository" kicker="02 · Read the authorized remote">
        <p><strong>Clone source · GitHub</strong> selects a repository from the workspace&apos;s GitHub App access. <strong>Refresh connected repositories</strong> updates that catalog. Entering another owner/repository does not grant access to it; the provider and server still decide whether that repository is authorized.</p>
        <p><strong>Local repositories folder</strong> is the destination parent folder for Clone. Clone requests a local checkout; selecting a connected repository does not synchronize an existing checkout automatically. Check the local branch and working tree separately before editing or publishing.</p>
        <p>A connected installation or a repository name is not proof that the current branch, file bytes, pull request or deployment evidence has been verified. Supported actions perform their own checks. Repository reads and provider changes have separate authority boundaries.</p>
        <p>If the app reports GitHub access is unavailable, Existing local files remain usable. Open Settings → Integrations to review the recorded connection and supported validation controls before cloning or syncing. See <Link href="/docs/integration-setup">integration setup</Link> and the <Link href="/docs/permissions-model">permissions model</Link>.</p>
      </DocSection>

      <DocSection id="ai-context" title="Preparing context is not sending it" kicker="03 · Review the exact excerpt">
        <p><strong>Ask Agent</strong> prepares an explicitly confirmed selection as an unsent Agent draft. Preparing that draft does not save a file, run a check or send code to a model. Choosing Send later shares the prompt with the approved provider; review it for credentials and private data first.</p>
        <p>The local selection control limits excerpts and refuses recognized sensitive paths. These controls do not guarantee that an otherwise permitted excerpt contains no secrets. Confirm what is in the draft, which provider is selected and whether sending is enabled for the workspace. AI context does not approve a repository change.</p>
      </DocSection>

      <DocSection id="evidence-labels" title="Preview, live and recorded evidence" kicker="04 · Read the label in context">
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Preview</strong> can be illustrative data. It is not evidence that a provider action ran.</li>
          <li><strong>Live or connected</strong> describes the data or connection state shown by that view. It does not certify every integration, the current repository revision or deployment success.</li>
          <li><strong>Recorded results</strong> describe an observation at its recorded time and scope. Local files, remote branches and permissions may have changed since then.</li>
        </ul>
        <Callout variant="warning" title="When an outcome is uncertain">
          Do not resend an uncertain or consumed action. Inspect the saved operation and use its supported read-only recovery path. A refresh, old check or previously successful connection cannot supply missing execution evidence.
        </Callout>
        <p>Once the source and intended target are clear, follow the <Link href="/docs/approval-workflow">approval workflow</Link>. Approval, execution and verified outcome remain separate steps.</p>
      </DocSection>

      <DocFooterNav prev={{ href: "/docs/getting-started", label: "Getting started" }} next={{ href: "/docs/permissions-model", label: "Permissions model" }} />
      <DocFeedback />
    </>
  );
}
