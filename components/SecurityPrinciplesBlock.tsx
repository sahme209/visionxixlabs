type SecurityPrinciplesBlockProps = {
  title?: string;
  items: string[];
};

export function SecurityPrinciplesBlock({
  title = "How we approach security",
  items,
}: SecurityPrinciplesBlockProps) {
  return (
    <section
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
      aria-labelledby="security-principles-heading"
    >
      <h2
        id="security-principles-heading"
        className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4"
      >
        {title}
      </h2>
      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
        {items.map((item) => (
          <li key={item} className="flex items-start">
            <span className="text-indigo-500 mr-2 mt-0.5 shrink-0">•</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
