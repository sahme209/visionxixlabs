import type {Metadata} from 'next';
import Link from 'next/link';
import {Callout,DocFooterNav,DocHeader,DocSection} from '@/components/docs/DocPrimitives';

export const metadata:Metadata={title:'Product surfaces — Axiom Documentation',description:'Choose the right Axiom desktop workspace or public guide, and distinguish browsing, review, execution and help.',alternates:{canonical:'/docs/surfaces'}};

const DESTINATIONS=[
 {name:'Agent',purpose:'Work with code, local files and research through the Agent conversation.',next:'Inspect the proposed tool and its scope. For a change, follow the exact review and execution controls available in your version.'},
 {name:'Axiom Bot',purpose:'Describe an outcome, keep a saved task, request an AI response or open reviewed app actions.',next:'Check which task owns the response or action. Saving a task or receiving an AI response does not authorize a provider action.'},
 {name:'Releases',purpose:'Find release requests, their plans, exact action reviews and available outcome evidence.',next:'Start with the request’s next required step. The authorized requester and independent reviewer have different responsibilities; a dispatch acknowledgment is not application-health evidence.'},
 {name:'Repositories',purpose:'Select and inspect repository context and use the available local or connected repository controls.',next:'Check the repository, branch and file before editing or proposing a write. Viewing code does not grant commit, push or merge authority.'},
 {name:'Batches',purpose:'Inspect supported Airflow workflows, runs and their available automation controls.',next:'Check the configured connection and source run first. The Batches label does not imply that other orchestration services are connected or supported.'},
 {name:'Apps & skills',purpose:'Browse connected-app entries and reusable skills, and open the relevant setup or workflow.',next:'Separate a catalogue entry from a validated connection. A skill is reusable guidance, not a permission grant. Setup may require a workspace administrator.'},
 {name:'Documentation',purpose:'Open operating guidance in your browser from the desktop documentation index.',next:'Choose the guide for your installed version and task. Reading documentation does not change a workspace or run an operation.'},
 {name:'Settings',purpose:'Manage the settings and connection controls available to your current account.',next:'Read the exact scope and required permission before changing a setting or starting provider consent. Ask the authorized administrator when setup is blocked.'},
] as const;

export default function SurfacesPage(){return <>
 <DocHeader kicker="Workflow reference · Navigation" title="Find the right place to work." summary="Use the desktop for operational work and the website for public guidance. Start from the task you need to complete, then check its access and next decision." />
 <Callout title="Version and availability">
  These destinations are registered in the current local desktop source. Your installed version may have different labels or controls; local previews are not automatically production-activated. This is a navigation guide, not proof that a connection, workflow or Governance enforcement is ready. The Governance Intelligence prototype is not a registered customer destination in this navigation.
 </Callout>
 <DocSection id="desktop" title="Choose a desktop destination" kicker="01">
  <p>Open the installed app and use its sidebar. A destination organizes work; it does not authorize a provider action. Read-only inspection, proposing a change, independent review and execution are separate concerns.</p>
  <div className="space-y-6">{DESTINATIONS.map(item=><section key={item.name} aria-labelledby={`surface-${item.name.toLowerCase().replace(/[^a-z]+/g,'-')}`}>
   <h3 id={`surface-${item.name.toLowerCase().replace(/[^a-z]+/g,'-')}`} className="font-semibold text-white">{item.name}</h3>
   <p>{item.purpose}</p><p><strong>Next:</strong> {item.next}</p>
  </section>)}</div>
 </DocSection>
 <DocSection id="website" title="Use the website for guidance" kicker="02">
  <ul className="list-disc space-y-3 pl-5">
   <li><Link href="/download">Download the desktop app</Link> — inspect the current manifest-backed installer and platform-specific verification information.</li>
   <li><Link href="/docs">Public documentation</Link> — read setup, workflow and recovery references without starting an action.</li>
   <li><Link href="/demo">Illustrative demo</Link> — explore the explanation of a workflow. Demo content is not a live workspace or evidence that an action ran.</li>
   <li><Link href="/account/help">Account help (sign-in required)</Link> — use the authenticated help surface when available; this public guide grants no account access.</li>
  </ul>
  <p>Browser sign-in and provider-consent pages support specific authentication or connection steps. Returning from a browser does not by itself prove that desktop pairing, connection validation or an operation succeeded.</p>
 </DocSection>
 <DocSection id="next-owner" title="Know who acts next" kicker="03">
  <p>The person preparing work checks its exact source, target and content. An authorized independent reviewer makes the required decision personally. Who executes next, and whether execution is a separate control, depends on the supported workflow and installed version. See <Link href="/docs/approval-workflow">Review and execution guidance</Link>.</p>
  <p>If a connection or permission is missing, use its supported setup path or ask the authorized administrator. A different screen, a catalogue entry or an old approval does not remove that requirement.</p>
  <Callout variant="warning" title="Keep uncertain work in its original history">Do not resend an uncertain or consumed action. Inspect the original saved record using the supported read-only history or recovery controls. A different destination is not a retry permission.</Callout>
  <p><Link href="/docs/troubleshooting">Troubleshoot the current state</Link> before preparing another action.</p>
 </DocSection>
 <DocFooterNav prev={{href:'/docs/execution-plans',label:'Execution plans'}} next={{href:'/docs/glossary',label:'Glossary'}} />
 </>}
