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
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6"
      aria-labelledby="security-principles-heading"
    >
      <h2
        id="security-principles-heading"
        className="text-lg font-semibold text-white mb-4"
      >
        {title}
      </h2>
      <ul className="space-y-2 text-sm text-zinc-400">
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
