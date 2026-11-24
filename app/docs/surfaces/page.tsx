import type {Metadata} from 'next';
import Link from 'next/link';
import {Callout,DocFooterNav,DocHeader,DocSection} from '@/components/docs/DocPrimitives';

export const metadata:Metadata={title:'Product surfaces — V19 Documentation',description:'Choose the right V19 desktop workspace or public guide, and distinguish browsing, review, execution and help.',alternates:{canonical:'/docs/surfaces'}};

const DESTINATIONS=[
 {name:'Agent',purpose:'Work with code, local files and research through the Agent conversation.',next:'Inspect the proposed tool and its scope. For a change, follow the exact review and execution controls available in your version.'},
 {name:'V19 Bot',purpose:'Describe an outcome, keep a saved task, request an AI response or open reviewed app actions.',next:'Check which task owns the response or action. Saving a task or receiving an AI response does not authorize a provider action.'},
 {name:'Releases',purpose:'Find release requests, their plans, exact action reviews and available outcome evidence.',next:'Start with the request’s next required step. The authorized requester and independent reviewer have different responsibilities; a dispatch acknowledgment is not application-health evidence.'},
 {name:'Repositories',purpose:'Select and inspect repository context and use the available local or connected repository controls.',next:'Check the repository, branch and file before editing or proposing a write. Viewing code does not grant commit, push or merge authority.'},
 {name:'Batches',purpose:'Inspect supported Airflow workflows, runs and their available automation controls.',next:'Check the configured connection and source run first. The Batches label does not imply that other orchestration services are connected or supported.'},
 {name:'Apps & skills',purpose:'Browse connected-app entries and reusable skills, and open the relevant setup or workflow.',next:'Separate a catalogue entry from a validated connection. A skill is reusable guidance, not a permission grant. Setup may require a workspace administrator.'},
 {name:'Documentation',purpose:'Read operating guides and explore the workflow map in the desktop Documentation view.',next:'Choose the guide for your installed version and task. Reading documentation does not change a workspace or run an operation.'},
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
 <DocSection id="workflow-map" title="Follow a desktop workflow">
  <p>In desktop versions that include it, open <strong>Documentation</strong> in the sidebar and select <strong>Workflow map</strong>. Choose Release, Tickets and recovery, or Batches.</p>
  <ol className="list-decimal space-y-3 pl-5">
   <li>Select <strong>Fit overview</strong> to see the workflow at a glance. Choose a responsibility group to jump to it. Drag an empty part of the canvas to pan when the map extends beyond its viewport.</li>
   <li>Select a step to open its details and <Link href="#workflow-map-next-steps">follow a conditional next step</Link>. Select <strong>Read the guide</strong> for the relevant instructions. If the canvas is hard to read at your current window size, use <strong>Step list</strong> to browse the same steps by group.</li>
   <li>Use <strong>Close details</strong> to return focus to the step you opened, or <strong>Back to guides</strong> to return to the guide reader.</li>
  </ol>
  <p>The map explains which evidence and approvals a workflow requires. Use the original workspace record to confirm the current version, result and available actions.</p>
 </DocSection>
 <DocSection id="workflow-map-next-steps" title="Follow conditional next steps in the workflow map">
  <p>In desktop versions that include the workflow map, open a step and read the condition below each option in <strong>Next steps</strong>. Matching a condition is a navigation choice. Use the original release, ticket or batch record to verify which condition applies.</p>
  <p>On the Release map, <strong>Review current authority</strong> shows <strong>Run the supported operation</strong> for <strong>Current approval and authority</strong>. If approval was rejected or expired, or the saved release changed, choose <strong>Hold for review</strong> under <strong>Rejected, expired or changed</strong>. Once the missing evidence or permission is resolved, use <strong>Return to review</strong> and verify the current saved version.</p>
  <p>On the Batches map, choose <strong>Inspect the run’s tasks</strong> for <strong>Run failed or task details needed</strong>. Follow the <Link href="#batch-failed-run">failed-run guide</Link> from that step for the exact task read.</p>
  <p>Selecting a branch opens the destination step’s details and moves focus to its heading. <strong>Close details</strong> returns keyboard focus to the step that opened the details. <strong>Read the guide</strong> opens the selected step’s documentation. The map is read-only. Use the separate <Link href="/docs/approval-workflow">approval and execution workflow</Link> for any action.</p>
 </DocSection>
 <DocSection id="batch-failed-run" title="Inspect a failed Airflow run in Batches release dependencies">
  <p>In desktop versions with <strong>Inspect failed run</strong>, open <strong>Batches</strong>, choose <strong>Release dependencies</strong>, select the exact submitted release version and select <strong>Check batches</strong>. The check requires pipeline read access and uses the Airflow runs declared on that version.</p>
  <p>If a run failed, select <strong>Inspect failed run</strong> to open the first recorded failed run’s tasks. V19 moves focus to that run’s task control. To choose another observed run, select <strong>Inspect tasks</strong> below its workflow and run.</p>
  <p>Waiting or unverified results leave readiness unresolved. The failed-run shortcut only appears after a recorded failure. If the release version changed, reopen the current release and check its declared runs again.</p>
  <p>Use <strong>Retry tasks</strong> to repeat an unavailable task read. This read shows the observed task state and attempt number. It grants no permission to retry an Airflow run or execute a deployment. For a completed check, return to the <Link href="/docs/approval-workflow">release approval workflow</Link>.</p>
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
 <DocSection id="recordings" title="Watch a V19 desktop recording or scripted tour">
  <p>The <Link href="/demo">public demo</Link> is a scripted tour with sample data. An authentic desktop recording is currently unavailable. The tour explains the workflow without running a provider action.</p>
  <p>When a reviewed recording is available on the homepage, its player shows the exact V19 version, platform and build source, with a still preview, captions and a transcript. Playback starts when you choose Play.</p>
 </DocSection>
 <DocSection id="next-owner" title="Know who acts next" kicker="03">
  <p>The person preparing work checks its exact source, target and content. An authorized independent reviewer makes the required decision personally. Who executes next, and whether execution is a separate control, depends on the supported workflow and installed version. See <Link href="/docs/approval-workflow">Review and execution guidance</Link>.</p>
  <p>If a connection or permission is missing, use its supported setup path or ask the authorized administrator. A different screen, a catalogue entry or an old approval does not remove that requirement.</p>
  <Callout variant="warning" title="Keep uncertain work in its original history">Do not resend an uncertain or consumed action. Inspect the original saved record using the supported read-only history or recovery controls. A different destination is not a retry permission.</Callout>
  <p><Link href="/docs/troubleshooting">Troubleshoot the current state</Link> before preparing another action.</p>
 </DocSection>
 <DocFooterNav prev={{href:'/docs/execution-plans',label:'Execution plans'}} next={{href:'/docs/glossary',label:'Glossary'}} />
 </>}
