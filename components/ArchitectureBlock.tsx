"use client";

type ArchitectureBlockProps = {
  title: string;
  principles: string[];
};

export function ArchitectureBlock({ title, principles }: ArchitectureBlockProps) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
        {title}
      </h2>
      <div className="border-l-4 border-indigo-600 dark:border-indigo-500 pl-6 space-y-4">
        {principles.map((principle) => (
          <p
            key={principle}
            className="text-slate-700 dark:text-slate-300 text-sm md:text-base"
          >
            {principle}
          </p>
        ))}
      </div>
    </section>
  );
}
