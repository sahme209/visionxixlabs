/** Short walkthroughs of the desktop app recorded in a browser preview with synthetic data (harness/video-pilot). */
export interface PreviewTour { id: string; label: string; summary: string; video: string; poster: string; steps: string[] }

export const PREVIEW_TOURS: PreviewTour[] = [
  { id: "home", label: "Home", summary: "Plan a change, see recorded workflow runs, and follow the next actions.", video: "/media/preview/home.mp4", poster: "/media/preview/home-poster.webp",
    steps: ["Home is your starting point", "Describe a change and V19 drafts a plan", "Workflow runs over the last 30 days", "Recent deployment activity, filtered by request state", "Next actions come from loaded draft and submitted releases", "The release pipeline: plan, validate, approve, deploy, verify"] },
  { id: "deployments", label: "Deployments", summary: "Inspect an exact release version, its coverage and the recorded runs.", video: "/media/preview/deployments.mp4", poster: "/media/preview/deployments-poster.webp",
    steps: ["Every release request and its evidence", "Run success rate and median time, from recorded runs only", "Select a release to inspect its lifecycle", "Release risk radar: how much of this version's record is covered", "Overview, Evidence and Logs stay bound to this exact version", "The environment board: the latest recorded run in each environment", "Recorded workflow runs show dispatch, observation and completion"] },
  { id: "tickets", label: "Tickets", summary: "Triage incidents and open the release they are linked to.", video: "/media/preview/tickets.mp4", poster: "/media/preview/tickets-poster.webp",
    steps: ["Tickets lists recorded incidents and change requests", "Recovery at a glance: open incidents and median time to mitigate and resolve", "The severity mix counts loaded incidents", "Select an incident to open its investigation", "The linked release sits beside the timeline", "Review the evidence attached to the release", "Viewing evidence never authorises a deployment"] },
  { id: "batches", label: "Batches", summary: "See which upstream jobs each automation waits for.", video: "/media/preview/batches.mp4", poster: "/media/preview/batches-poster.webp",
    steps: ["Airflow workflows and release dependencies", "Automations react to a DAG's recorded state", "Saved dependencies: which upstream DAGs each automation waits for", "Hover a DAG to trace its path", "Paused automations stay dashed and neutral"] },
];
