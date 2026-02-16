type OutcomeSummaryProps = {
  items: string[];
  title?: string;
};

export function OutcomeSummary({
  items,
  title = "Outcome",
}: OutcomeSummaryProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
      <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        {title}
      </h4>
      <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
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
