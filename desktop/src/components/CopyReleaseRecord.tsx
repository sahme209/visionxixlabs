import { useState } from "react";
import type { DeploymentRequestSummary } from "../../../lib/tauri/deploymentRequestSummary";

/** The exact saved release version as JSON, for a change ticket, audit note or a file kept in Git. Read-only. */
export function releaseRecordJson(request: DeploymentRequestSummary): string {
  return JSON.stringify({
    kind: "v19.release-record",
    id: request.id, version: request.version, title: request.title, status: request.status,
    correlationId: request.correlationId, submittedAt: request.submittedAt, updatedAt: request.updatedAt,
    releaseContext: request.releaseContext,
    note: "Exported from the saved release record. It is not an approval and does not authorise a deployment.",
  }, null, 2);
}

export function CopyReleaseRecord({ request }: { request: DeploymentRequestSummary }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return <p className="mt-2 flex flex-wrap items-center gap-2">
    <button type="button" className="underline underline-offset-2 hover:text-zinc-200" onClick={async () => {
      try { await navigator.clipboard.writeText(releaseRecordJson(request)); setState("copied"); }
      catch { setState("failed"); }
    }}>Copy release record (JSON)</button>
    <span role="status" className="text-zinc-400">{state === "copied" ? "Copied this exact version." : state === "failed" ? "Copy was not available. Select the identifiers above instead." : ""}</span>
  </p>;
}
