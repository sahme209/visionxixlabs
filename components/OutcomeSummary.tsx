type OutcomeSummaryProps = {
  items: string[];
  title?: string;
};

export function OutcomeSummary({
  items,
  title = "Outcome",
}: OutcomeSummaryProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
        {title}
      </h4>
      <ul className="space-y-1.5 text-sm text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="text-indigo-500 mt-0.5 shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
