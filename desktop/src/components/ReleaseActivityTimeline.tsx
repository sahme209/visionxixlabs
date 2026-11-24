import {useEffect, useRef, useState} from "react";
import {desktopClient} from "../lib/desktopClient";
import {hasCompleteOperationPlanHistory, isOperationPlanList, operationPlanEventLabels} from "../lib/releaseOperationPlanContract";

type Activity = {
  events: Array<{ key: string; at: string; label: string; pullRequest: number }>;
  truncated: boolean;
};

export function ReleaseActivityTimeline({requestId, version, workspaceId}: {
  requestId: string;
  version: number;
  workspaceId: string;
}) {
  const context = useRef({config: desktopClient.config, revision: desktopClient.getContextRevision()}).current;
  const flight = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<Activity | null>();
  useEffect(() => () => flight.current?.abort(), []);

  async function load() {
    if (flight.current || context.config !== desktopClient.config || context.revision !== desktopClient.getContextRevision()) return;
    const controller = new AbortController();
    flight.current = controller;
    setLoading(true);
    setActivity(undefined);
    let next: Activity | null = null;
    try {
      const result = await desktopClient.releaseOperationPlans(requestId, version, controller.signal);
      if (result.ok && isOperationPlanList(result.data, requestId, version)
        && result.data.plans.every(row => row.plan.organizationId === workspaceId && hasCompleteOperationPlanHistory(row))) {
        const events = result.data.plans.filter(row => row.requestVersion === version).flatMap(row =>
          row.history.map(event => ({
            key: `${row.id}:${event.sequence}`, at: event.at, label: operationPlanEventLabels[event.type], pullRequest: row.plan.pullRequest.number,
          })),
        );
        events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        next = {events, truncated: result.data.truncated};
      }
    } catch {
      // Keep the same unavailable state for a rejected or failed read.
    } finally {
      flight.current = null;
      if (!controller.signal.aborted && context.config === desktopClient.config && context.revision === desktopClient.getContextRevision()) {
        setActivity(next);
        setLoading(false);
      }
    }
  }

  return <section aria-label="Release activity" className="studio-release-activity">
    <header>
      <div><h3>Release activity</h3><p>Saved merge-plan events for release version {version}</p></div>
      <button type="button" className="btn-secondary" disabled={loading} onClick={() => void load()}>
        {activity ? "Refresh activity" : "Load activity"}
      </button>
    </header>
    {loading && <p role="status">Loading release activity…</p>}
    {activity === null && <p role="alert">Release activity could not be verified.</p>}
    {activity?.truncated && <p role="status">Showing activity from the latest loaded plans.</p>}
    {activity?.events.length === 0 && <p role="status">No activity for this version in the loaded plans.</p>}
    {activity && activity.events.length > 0 && <>
      <ol>
        {activity.events.map(event => <li key={event.key}>
          <div><p>{event.label}</p><span>Pull request #{event.pullRequest}</span></div>
          <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
        </li>)}
      </ol>
      <p>Execution approvals and outcomes are checked in their own controls.</p>
    </>}
  </section>;
}
