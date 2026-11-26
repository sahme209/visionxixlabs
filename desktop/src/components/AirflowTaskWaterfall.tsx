import { layoutWaterfall } from "../../../lib/desktop/airflowTaskWaterfall";
import type { AirflowTaskPage } from "../lib/desktopClient";
import { formatRunElapsed } from "./DeploymentWorkflowEvidence";

/** Observed task timing as a waterfall. Bars use recorded start/end only; open bars have no recorded end yet. */
export function AirflowTaskWaterfall({ tasks }: { tasks: AirflowTaskPage["tasks"] }) {
  const { bars, spanSeconds } = layoutWaterfall(tasks);
  if (bars.length < 2) return null;
  return (
    <figure className="airflow-waterfall" aria-label="Observed task timing">
      <figcaption>Task timing on this page · {formatRunElapsed(new Date(0), new Date(spanSeconds * 1000)) ?? "0s"} from first start to last recorded instant</figcaption>
      <ol>{bars.map((bar, index) => (
        <li key={bar.key} data-tone={bar.tone} style={{ ["--delay" as string]: `${index * 40}ms` }}>
          <span className="airflow-waterfall-label" title={bar.label}>{bar.label}</span>
          <span className="airflow-waterfall-track">
            <span className="airflow-waterfall-bar" data-open={bar.open || undefined} style={{ left: `${bar.left * 100}%`, width: `${bar.width * 100}%` }}
              title={`${bar.label} · ${bar.state}${bar.seconds !== null ? ` · ${formatRunElapsed(new Date(0), new Date(bar.seconds * 1000))}` : " · no recorded end"}`} />
          </span>
          <span className="airflow-waterfall-time">{bar.seconds !== null ? formatRunElapsed(new Date(0), new Date(bar.seconds * 1000)) : "open"}</span>
        </li>
      ))}</ol>
    </figure>
  );
}
