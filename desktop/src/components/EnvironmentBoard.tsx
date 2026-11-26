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
  if (!environments?.length || !executions.length) return null;
  const board = buildEnvironmentBoard(environments, executions);
  if (!board.rows.length) return null;
  return (
    <section className="environment-board" aria-labelledby="environment-board-title">
      <header>
        <h2 id="environment-board-title">Environment board</h2>
        <p>Latest recorded workflow run for each repository in each environment, in lifecycle order. This is recorded evidence, not the live deployed version.</p>
      </header>
      <div className="environment-board-scroll" role="region" aria-label="Environment board table" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Repository</th>{board.environments.map(env => <th key={env.id} scope="col">{env.name}<span>{env.tier}</span></th>)}</tr></thead>
          <tbody>{board.rows.map(row => <tr key={row.repository}>
            <th scope="row">{row.repository}</th>
            {row.cells.map((cell, index) => <td key={board.environments[index].id}>{cell ? (() => {
              const tone = runResultTone(cell.status, cell.conclusion);
              return <div className="environment-board-cell" data-tone={tone.tone}>
                <StatusIconChip tone={tone.tone} shape={tone.shape} size={12}/>
                <span><code>{cell.commit ?? "no commit"}</code>{cell.ref && <small>{cell.ref}</small>}</span>
                <time dateTime={cell.at}>{new Date(cell.at).toLocaleDateString([], { month: "short", day: "numeric" })}</time>
              </div>;
            })() : <span className="environment-board-empty">No recorded run</span>}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {board.unplaced > 0 && <p className="environment-board-note">{board.unplaced} recorded run{board.unplaced === 1 ? "" : "s"} for environments not in this workspace’s list are not shown.</p>}
    </section>
  );
}
