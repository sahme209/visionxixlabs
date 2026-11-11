import { useMemo, useState } from "react";
import { createLineDiff, type DiffLine } from "../lib/lineDiff";

export function FileDiff({ before, after, label = "Proposed file diff", unchangedMessage = "No content changes detected. Reject this proposal unless an unchanged commit is intentional." }: { before: string; after: string; label?: string; unchangedMessage?: string }) {
  const [pagination, setPagination] = useState({ before, after, page: 0 });
  const sameSource = pagination.before === before && pagination.after === after;
  if (!sameSource) setPagination({ before, after, page: 0 });
  const setPage = (page: number) => setPagination({ before, after, page });
  const lines = useMemo(() => createLineDiff(before, after), [before, after]);
  const pageCount = Math.max(1, Math.ceil(lines.length / 2000));
  const currentPage = Math.min(sameSource ? pagination.page : 0, pageCount - 1);
  const additions = lines.filter((line) => line.kind === "add").length;
  const removals = lines.filter((line) => line.kind === "remove").length;
  if (additions === 0 && removals === 0) {
    return <p className="rounded-lg border border-amber-400/20 bg-amber-400/6 px-3 py-2 text-xs text-amber-200">{unchangedMessage}</p>;
  }
  return (
    <div>
      <p className="mb-2 text-[11px]"><span className="text-emerald-400">+{additions}</span><span className="ml-2 text-rose-400">−{removals}</span></p>
      {lines.length > 2000 && <div className="mb-2 space-y-2 text-xs text-amber-300">
        <p role="status">Diff display limited to 2,000 rows per page. Page {currentPage + 1} of {pageCount}; review every page before saving or approving.</p>
        <div className="flex gap-2">
          <button data-help-id="shared.file-diff-previous" type="button" aria-label="Previous diff page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="btn-secondary disabled:opacity-40">Previous</button>
          <button data-help-id="shared.file-diff-next" type="button" aria-label="Next diff page" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} className="btn-secondary disabled:opacity-40">Next</button>
        </div>
      </div>}
      <div tabIndex={0} aria-label={label} className="max-h-80 overflow-auto rounded-lg border border-white/6 bg-black/30 font-mono text-[11px] leading-5">
        {lines.slice(currentPage * 2000, (currentPage + 1) * 2000).map((line, index) => <DiffRow key={`${index}:${line.kind}:${line.oldLine ?? ""}:${line.newLine ?? ""}`} line={line} />)}
      </div>
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  if (line.kind === "omitted") return <div className="px-3 py-1 text-center text-zinc-600">{line.text}</div>;
  const marker = line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " ";
  const tone = line.kind === "add"
    ? "bg-emerald-400/8 text-emerald-100"
    : line.kind === "remove"
      ? "bg-rose-400/8 text-rose-100"
      : "text-zinc-400";
  return (
    <div className={`grid min-w-max grid-cols-[2.5rem_2.5rem_1.25rem_minmax(0,1fr)] ${tone}`}>
      <span className="select-none border-r border-white/4 px-2 text-right text-zinc-600">{line.oldLine ?? ""}</span>
      <span className="select-none border-r border-white/4 px-2 text-right text-zinc-600">{line.newLine ?? ""}</span>
      <span className="select-none text-center">{marker}</span>
      <span className="whitespace-pre pr-3">{line.text || " "}</span>
    </div>
  );
}
