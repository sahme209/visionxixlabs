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
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        {title}
      </h2>
      <p className="text-zinc-400 mb-6 max-w-3xl">
        Concrete outputs you receive so delivery is tangible and reviewable.
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start text-zinc-300"
          >
            <span className="text-indigo-500 mr-3 mt-0.5 flex-shrink-0" aria-hidden>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
