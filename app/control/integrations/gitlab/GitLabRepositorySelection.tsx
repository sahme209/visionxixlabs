"use client";

import {useState} from "react";
import {GitLabConnectionPanel} from "@/components/cockpit/GitLabConnectionPanel";
import {RepositorySyncControls} from "@/components/cockpit/RepositorySyncControls";

export function GitLabRepositorySelection({repositories}: {
  repositories: {id: string; remoteOwner: string; remoteName: string}[];
}) {
  const [repositoryId, setRepositoryId] = useState(repositories.length === 1 ? repositories[0].id : "");
  const selected = repositories.find(row => row.id === repositoryId);

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-[#111111] p-4">
      <label className="block text-sm text-zinc-300">
        Workspace repository
        <select value={repositoryId} onChange={event => setRepositoryId(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-zinc-100">
          <option value="">Select a GitLab repository</option>
          {repositories.map(row => <option key={row.id} value={row.id}>{row.remoteOwner}/{row.remoteName}</option>)}
        </select>
      </label>
      {selected && (
        <GitLabConnectionPanel key={selected.id} repositoryId={selected.id}>
          <RepositorySyncControls repositoryId={selected.id} />
        </GitLabConnectionPanel>
      )}
    </div>
  );
}
