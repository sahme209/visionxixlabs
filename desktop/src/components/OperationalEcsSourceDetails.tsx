import type {EcsReviewPreview} from '../../../lib/governance/platform/operations/ecsReviewContract';
/** Escaped nonsecret source details shared by the two distinct human stages. */
export function OperationalEcsSourceDetails({preview}:{preview:EcsReviewPreview}){const {actionId,manifest:m}=preview;return <>
   <dl className="grid gap-4 text-sm sm:grid-cols-2">
    <div><dt className="text-zinc-400">Operation</dt><dd>{m.operation==='rollback'?'Separately reviewed rollback':'Force deployment of the selected task definition'}</dd></div>
    <div><dt className="text-zinc-400">Account / region</dt><dd>{m.target.accountId} · {m.target.region}</dd></div>
    <div className="sm:col-span-2"><dt className="text-zinc-400">Service</dt><dd className="break-all font-mono text-xs">{m.target.serviceArn}</dd></div>
    <div className="sm:col-span-2"><dt className="text-zinc-400">Exact task definition</dt><dd className="break-all font-mono text-xs">{m.target.taskDefinitionArn}</dd></div>
    <div><dt className="text-zinc-400">Original workflow run</dt><dd>{m.workload.runId} · attempt {m.workload.attempt}</dd></div>
    <div><dt className="text-zinc-400">Review expires</dt><dd>{new Date(m.expiresAt).toLocaleString()}</dd></div>
   </dl>
   <details className="text-xs text-zinc-400"><summary>Source, identity and recovery references</summary><dl className="mt-3 space-y-2 break-all"><div><dt>Action</dt><dd>{actionId}</dd></div><div><dt>Plan</dt><dd>{preview.planDigest}</dd></div><div><dt>Commit</dt><dd>{m.workload.commit}</dd></div><div><dt>Workflow</dt><dd>{m.workload.workflowPath}</dd></div><div><dt>Execution role</dt><dd>{m.roleArn}</dd></div><div><dt>Source evidence</dt><dd>{m.sourceEvidenceId}</dd></div><div><dt>Requested by</dt><dd>{preview.requesterUserId}</dd></div></dl>{m.operation==='rollback'&&<p className="mt-3">Requires qualified terminal failure for {m.condition.failedActionId}, generation {m.condition.generation}, receipt {m.condition.failureReceiptId}. A timeout alone never qualifies.</p>}</details>
 </>}
