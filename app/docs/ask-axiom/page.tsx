import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Ask Axiom — Axiom Documentation",
 description: "How the Ask Axiom support chat answers, what it can see, and what it can do for you.",
 alternates: { canonical: "/docs/ask-axiom" },
};
export default function AskAxiomDocsPage() {
 return <>
  <DocHeader kicker="Support" title="Ask Axiom."
   summary="The support chat answers from Axiom's public docs with sources, and can help with your own workspace when you are signed in." />
  <Callout variant="warning" title="Never share secrets">Do not paste passwords, API keys or tokens into the chat. Messages that look like secrets are refused and removed from the chat history in your browser. If you shared a real secret, rotate it.</Callout>
  <DocSection id="answers" kicker="01" title="Answers from the docs">
   <p>Answers come from the public FAQ, documentation and reviewed product facts, and always list their sources. No AI model is used for these answers. When Ask Axiom is not confident, it shows the closest guides and offers to send your question to support.</p>
  </DocSection>
  <DocSection id="ai" kicker="02" title="Fuller AI answers">
   <p>Signed-in members of a workspace with AI turned on can choose <strong>Get a fuller AI answer</strong>. It uses prepaid AI credits and the same governed AI path as the Agent. The model sees only the retrieved public passages and must cite them; otherwise the docs answer is kept.</p>
  </DocSection>
  <DocSection id="workspace" kicker="03" title="Help with your workspace">
   <p>When you are signed in, Ask Axiom can tell you what is waiting for approval, which agent requests are pending, which connections are active, when the audit log was last sealed and what happened recently. Every answer is read-only and comes from your current workspace only.</p>
   <p>Say <em>something is broken</em> or <em>run a health check</em> for a saved-state diagnostic with links to fix each finding. It does not test providers live.</p>
  </DocSection>
  <DocSection id="actions" kicker="04" title="What it can do for you">
   <p>It can open a pre-filled support request that you review and send, and it can send an access request to your workspace admins. It never changes roles or approves actions; admins and approvers decide.</p>
   <p>It can also run three fixed actions, governed like any other agent: <em>seal the audit log</em> (owners and admins), <em>verify the audit log</em> (any member) and <em>list API keys expiring soon</em> (owners and admins; it shows names, prefixes and dates, never secrets). Each shows exactly what it will do and runs only after you confirm that action. The server checks your role again, and every run is recorded in the audit log under your name. Sealing adds a record and never edits or deletes events; the other two are read-only.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/batch-providers",label:"Batch providers"}} next={{href:"/docs/plugins",label:"Apps and skills"}} />
 </>;
}
