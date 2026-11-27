/** Deployment outcome in plain words from the recorded status and conclusion. */
export function deploymentOutcomeLabel(status: string, conclusion: string | null): { label: string; tone: "ok" | "bad" | "neutral" } {
  if (status === "completed") {
    if (conclusion === "success") return { label: "Succeeded", tone: "ok" };
    if (conclusion === "cancelled") return { label: "Cancelled", tone: "neutral" };
    return { label: conclusion ? `Failed (${conclusion})` : "Finished, result not recorded", tone: conclusion ? "bad" : "neutral" };
  }
  if (status === "in_progress") return { label: "Running", tone: "neutral" };
  if (status === "queued") return { label: "Queued", tone: "neutral" };
  return { label: status, tone: "neutral" };
}
