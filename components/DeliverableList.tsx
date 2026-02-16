"use client";

type DeliverableListProps = {
  title?: string;
  items: string[];
};

export function DeliverableList({
  title = "Deliverables",
  items,
}: DeliverableListProps) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h2>
      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-3xl">
        Concrete outputs you receive so delivery is tangible and reviewable.
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start text-slate-700 dark:text-slate-300"
          >
            <span className="text-indigo-500 mr-3 mt-0.5 flex-shrink-0" aria-hidden>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
