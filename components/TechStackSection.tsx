"use client";

type StackGroup = {
  label: string;
  items: string[];
};

type TechStackSectionProps = {
  title?: string;
  groups: StackGroup[];
};

export function TechStackSection({
  title = "Tooling & stack",
  groups,
}: TechStackSectionProps) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-3xl">
        We use tools we know and that fit your environment. No exaggeration; we list what we use.
      </p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.label}
            className="card-hover bg-white dark:bg-slate-800 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-slate-700"
          >
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              {group.label}
            </h3>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
