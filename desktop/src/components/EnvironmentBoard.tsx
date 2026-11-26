import { useEffect, useState } from "react";
import { buildEnvironmentBoard, type BoardEnvironment } from "../../../lib/desktop/environmentBoard";
import { desktopClient, type DeploymentExecution } from "../lib/desktopClient";
import { StatusIconChip, runResultTone } from "./StatusBadge";

/** Latest recorded workflow run per repository and environment, in lifecycle order. Not the live deployed version. */
export function EnvironmentBoard({ executions }: { executions: DeploymentExecution[] }) {
  const [environments, setEnvironments] = useState<BoardEnvironment[] | null | undefined>();
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => desktopClient.listEnvironments()).then(result => {
      if (live) setEnvironments(result.ok && Array.isArray(result.data?.environments) ? result.data.environments : null);
    }).catch(() => { if (live) setEnvironments(null); });
    return () => { live = false; };
  }, []);
  const [checks, setChecks] = useState<Record<string, { total: number; passed: number; failed: number; missing: number }>>({});
  const shaKey = [...new Set(executions.map(e => e.sourceCommitSha).filter((s): s is string => typeof s === "string" && /^[0-9a-f]{40}$/.test(s)))].slice(0, 50).join(",");
  useEffect(() => {
    if (!shaKey) return;
    let live = true;
    // Optional evidence: unavailable leaves cells without a checks note.
    Promise.resolve().then(() => desktopClient.summarizeCommitChecks(shaKey.split(","))).then(result => {
      if (live && result.ok && result.data?.commits) setChecks(result.data.commits);
    }).catch(() => {});
    return () => { live = false; };
  }, [shaKey]);
  if (!environments?.length || !executions.length) return null;
  const board = buildEnvironmentBoard(environments, executions);
  if (!board.rows.length) return null;
  const trailing = board.rows.reduce((sum, row) => sum + row.gaps.length, 0);
  return (
    <section className="environment-board" aria-labelledby="environment-board-title">
      <details>
      <summary>
        <h2 id="environment-board-title">Environment board</h2>
        <span className="environment-board-count">{board.rows.length} repositor{board.rows.length === 1 ? "y" : "ies"} · {board.environments.length} environment{board.environments.length === 1 ? "" : "s"}{trailing ? ` · ${trailing} trailing` : ""}</span>
      </summary>
      <header>
        <p>Latest recorded workflow run for each repository in each environment, in lifecycle order. This is recorded evidence, not the live deployed version. “Trails” marks a later environment whose latest run is older than a newer successful commit before it; promotion still needs its own release and approval.</p>
      </header>
      <div className="environment-board-scroll" role="region" aria-label="Environment board table" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Repository</th>{board.environments.map(env => <th key={env.id} scope="col">{env.name}{env.tier.toLowerCase() !== env.name.toLowerCase() && <span>{env.tier}</span>}</th>)}</tr></thead>
          <tbody>{board.rows.map(row => <tr key={row.repository}>
            <th scope="row">{row.repository}{row.gaps.map(gap => <small key={gap.to} className="environment-board-gap">{gap.to} trails {gap.from} ({gap.commit})</small>)}</th>
            {row.cells.map((cell, index) => <td key={board.environments[index].id}>{cell ? (() => {
              const tone = runResultTone(cell.status, cell.conclusion);
              return <div className="environment-board-cell" data-tone={tone.tone}>
                <StatusIconChip tone={tone.tone} shape={tone.shape} size={12}/>
                <span><code>{cell.commit ?? "no commit"}</code>{cell.ref && <small>{cell.ref}</small>}{cell.config && <small title="Configuration fingerprint recorded when this run was dispatched">config {cell.config}</small>}{cell.sha && checks[cell.sha] && checks[cell.sha].total > 0 && <small title="Blocking deployment checks reported for this commit">{checks[cell.sha].failed ? `checks ${checks[cell.sha].failed} failed` : checks[cell.sha].missing ? `checks ${checks[cell.sha].passed}/${checks[cell.sha].total}` : "checks passed"}</small>}</span>
                <time dateTime={cell.at}>{new Date(cell.at).toLocaleDateString([], { month: "short", day: "numeric" })}</time>
              </div>;
            })() : <span className="environment-board-empty">No recorded run</span>}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      </details>
      {board.unplaced > 0 && <p className="environment-board-note">{board.unplaced} recorded run{board.unplaced === 1 ? "" : "s"} for environments not in this workspace’s list are not shown.</p>}
    </section>
  );
}
