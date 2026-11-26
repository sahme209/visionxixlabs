import type {Metadata} from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {Callout,DocFooterNav,DocHeader,DocSection} from '@/components/docs/DocPrimitives';

export const metadata:Metadata={title:'Product surfaces — V19 Documentation',description:'Choose the right V19 desktop workspace or public guide, and distinguish browsing, review, execution and help.',alternates:{canonical:'/docs/surfaces'}};

const DESTINATIONS=[
 {name:'Tickets',image:'/docs/desktop/tickets.webp',purpose:'Inspect recorded deployment incidents and change tickets in the workspace.',next:'Open the selected record. Use the source ticket and exact release version to confirm what the available action applies to.'},
 {name:'Agent',image:'/docs/desktop/agent.webp',purpose:'Work with code, local files and research through the Agent conversation.',next:'Inspect the proposed tool and its scope. For a change, follow the exact review and execution controls available in your version.'},
 {name:'Saved Tasks',image:'/docs/desktop/saved-tasks.webp',purpose:'Describe an outcome, keep a saved task, request an AI response or open reviewed app actions.',next:'Check which task owns the response or action. In versions that show it, each task in the list shows its last recorded run (AI task, readiness run or pull request evidence), with the stored status, whether it ran on the current version or an earlier one, and the date, or No recorded runs. Saving a task or receiving an AI response does not authorize a provider action.'},
 {name:'Deployments',image:'/docs/desktop/deployments.webp',purpose:'Find release requests, their plans, exact action reviews and available outcome evidence.',next:'Start with the request’s next required step. The authorized requester and independent reviewer have different responsibilities; a dispatch acknowledgment is not application-health evidence.'},
 {name:'Repositories',image:'/docs/desktop/repositories.webp',purpose:'Select and inspect repository context and use the available local or connected repository controls.',next:'Check the repository, branch and file before editing or proposing a write. Viewing code does not grant commit, push or merge authority.'},
 {name:'Batches',image:'/docs/desktop/batches.webp',purpose:'Inspect supported Airflow workflows, runs and their available automation controls.',next:'Check the configured connection and source run first. The Batches label does not imply that other orchestration services are connected or supported.'},
 {name:'Apps & Skills',image:'/docs/desktop/apps-and-skills.webp',purpose:'Browse connected-app entries and reusable skills, and open the relevant setup or workflow.',next:'Separate a catalogue entry from a validated connection. A skill is reusable guidance, not a permission grant. Setup may require a workspace administrator.'},
 {name:'Documentation',image:'/docs/desktop/documentation.webp',purpose:'Read operating guides and explore the workflow map in the desktop Documentation view.',next:'Choose the guide for your installed version and task. Reading documentation does not change a workspace or run an operation.'},
 {name:'Settings',image:'/docs/desktop/settings.webp',purpose:'Manage the settings and connection controls available to your current account.',next:'Read the exact scope and required permission before changing a setting or starting provider consent. Ask the authorized administrator when setup is blocked.'},
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
   <figure className="mt-3">
    <Image src={item.image} width={1600} height={1067} sizes="(min-width: 1024px) 760px, 100vw" className="h-auto w-full rounded-lg border border-white/10" alt={`${item.name} in the V19 desktop app, shown with synthetic example records`}/>
    <figcaption className="mt-2 text-xs text-zinc-400">{item.name} with synthetic example records. Your workspace shows your own records and the controls your role allows.</figcaption>
   </figure>
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
 <DocSection id="ticket-release-draft" title="Start, save and resume a release draft from Tickets">
  <p>In desktop versions with <strong>Start release draft</strong>, open a supported Jira or ServiceNow change in <strong>Tickets</strong>. Check its reference before opening the draft and review the scope before saving.</p>
  <p>To pause an unsaved draft, choose <strong>Close</strong>. During the same signed-in session, return to that ticket and select <strong>Resume release draft for</strong> followed by its reference. Other tickets keep their own drafts.</p>
  <p>Choose <strong>Save draft</strong>, then <strong>Open saved release draft</strong> to open the exact saved version in <strong>Deployments</strong>. Choose <strong>Return to source ticket</strong> to return to the original ticket. If the ticket is unavailable, V19 returns you to ticket search. Saving keeps the draft for review. Submission, approval and execution each have their own controls.</p>
 </DocSection>
 <DocSection id="ticket-collection-receipt" title="Check the collection receipt for incident evidence">
  <p>In desktop versions with <strong>Check collection receipt</strong>, open the incident in <strong>Tickets</strong>, choose <strong>Evidence</strong> and select <strong>Review linked release evidence</strong> to inspect the linked release. To record collection, an authorized operator needs a completed eligible workflow run and a verified comparison baseline.</p>
  <p>If <strong>Record evidence collection</strong> returns an uncertain result, choose <strong>Check collection receipt</strong>. This read-only check looks up the exact original attempt. If the receipt is still unavailable and <strong>Retry evidence collection</strong> is offered, that control retries the same collection attempt.</p>
  <p>A recovered receipt confirms the original collection record only. It does not prove application recovery, successful rollback or current release readiness. Use the incident overview to verify the current release and comparison baseline, and consult the <Link href="/docs/releaseops/readiness">release readiness guide</Link> for the remaining checks.</p>
 </DocSection>
 <DocSection id="release-closure-evidence" title="Read recorded closure evidence in Deployments">
  <p>In desktop versions with <strong>Read closure evidence</strong>, use a paired workspace session. Open <strong>Deployments</strong> and select the exact closed release version. Choose <strong>Read closure evidence</strong> below <strong>Closure recorded</strong>. V19 shows the evidence reference and reported outcome saved when that version was closed.</p>
  <p>If recording the closure returned an uncertain result, resume the closure draft and use <strong>Check closure status</strong> before attempting another write. If the evidence read is unavailable, confirm the release version and workspace, then try the read again. An unavailable receipt does not tell you that the closure failed.</p>
  <p>The receipt records a reported external outcome. Use the reference to check the original change or validation record and follow the <Link href="/docs/releaseops/readiness">release readiness guide</Link> for independent verification. Reading a receipt does not authorize or dispatch a deployment.</p>
 </DocSection>
 <DocSection id="batch-failed-run" title="Inspect a failed Airflow run in Batches release dependencies">
  <p>In desktop versions with <strong>Inspect failed run</strong>, open <strong>Batches</strong>, choose <strong>Release dependencies</strong>, select the exact submitted release version and select <strong>Check batches</strong>. The check requires pipeline read access and uses the Airflow runs declared on that version.</p>
  <p>If a run failed, select <strong>Inspect failed run</strong> to open the first recorded failed run’s tasks. V19 moves focus to that run’s task control. To choose another observed run, select <strong>Inspect tasks</strong> below its workflow and run.</p>
  <p>Waiting or unverified results leave readiness unresolved. The failed-run shortcut only appears after a recorded failure. If the release version changed, reopen the current release and check its declared runs again.</p>
  <p>In versions with the <strong>Observed task states</strong> table, read the task’s status, try number, and start and end times in UTC. Missing times show as unavailable. V19 clears the old rows when a task page fails to load. Choose <strong>Retry tasks</strong> to reread that same page, or <strong>Previous task page</strong> to return to the previous page when the control is available.</p>
  <p>Task inspection reads provider evidence. To retry an Airflow run or execute a deployment, use the separately authorized workflow. For a completed check, return to the <Link href="/docs/approval-workflow">release approval workflow</Link>.</p>
 </DocSection>
 <DocSection id="batch-closed-history" title="Find older closed releases in Batches History">
  <p>In desktop versions with the <strong>History</strong> action, use a paired workspace session and open <strong>Batches → Release dependencies</strong>. Choose <strong>History</strong> beside the Batches heading to load older closed releases with declared Airflow runs. The archive skips closed releases already in the recent list. Use <strong>Load more history</strong> for the next page, or <strong>Retry history</strong> if a page could not be verified.</p>
  <p>Search filters the loaded releases, including pages you opened in this visit. Select the historical row and check the saved version and recorded UTC closing time, when available. Choose <strong>Open release</strong> to view that version in Deployments, then follow the <Link href="#release-closure-evidence">recorded closure evidence guide</Link>. Choose <strong>Return to Batches</strong> to restore the historical row.</p>
  <p>Batches History shows saved closed release records. A closure receipt records a reported outcome. Use Airflow run evidence and independent validation for provider outcomes and application health. Viewing saved history makes no Airflow request and grants no approval or execution authority.</p>
 </DocSection>
 <DocSection id="batch-release-logs" title="Find release logs in desktop Batches">
  <p>In desktop versions with <strong>Open release logs</strong>, choose <strong>Batches → Release dependencies</strong> and select the saved release. Open <strong>Logs</strong>, then choose <strong>Open release logs</strong> to open the exact release version’s Logs section in <strong>Deployments</strong>.</p>
  <p>In versions with <strong>Find recorded workflow logs</strong>, choose it to open <strong>Evidence</strong>. Load the evidence plans, choose the saved plan, and select <strong>Read recorded workflow commit</strong>. When the saved observation matches the accepted dispatch, choose <strong>Open recorded workflow logs</strong> to return to Logs. The recorded timeline shows the run and attempt, when the dispatch was accepted, and when the outcome was last observed, in UTC. Use the GitHub link to open that exact attempt.</p>
  <p>In versions with <strong>Review workflow evidence</strong>, Logs states why the exact attempt is unavailable, such as a missing run receipt or more than one matching observation. It never implies a deployment outcome.</p>
  <p>Airflow task logs and live application health are unavailable in this view. Use the <Link href="#batch-failed-run">failed Airflow run guide</Link> to inspect observed task state and try numbers.</p>
  <p>From <strong>Deployments → Logs</strong>, use <strong>Return to Batches</strong> to restore the selected release, open Logs section and keyboard focus. If search has hidden the selection, clear the search to show the same version again. If a refresh finds a newer version, select it explicitly before opening its logs.</p>
 </DocSection>
 <DocSection id="release-record" title="Open a release record in the browser">
  <p>Some desktop views offer <strong>Open release record in browser</strong>. The record opens in the cockpit for your active workspace and is read-only.</p>
  <ul className="list-disc space-y-2 pl-5">
   <li>The heading shows the release tag, or <strong>Untagged release</strong> when none is recorded.</li>
   <li><strong>Status</strong>, <strong>Release ID</strong> and <strong>Commit</strong> show the recorded values. <strong>Awaiting a recorded commit</strong> means no commit is stored yet.</li>
   <li><strong>Linked change tickets</strong> lists up to 50 linked tickets, or says none are recorded.</li>
  </ul>
  <p>Release actions stay in V19 Studio. If the page says <strong>Release unavailable</strong>, check the workspace selector and reopen the link from the desktop app.</p>
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
