"use client";

type ArchitectureBlockProps = {
  title: string;
  principles: string[];
};

export function ArchitectureBlock({ title, principles }: ArchitectureBlockProps) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        {title}
      </h2>
      <div className="border-l-4 border-violet-500 pl-6 space-y-4">
        {principles.map((principle) => (
          <p
            key={principle}
            className="text-zinc-300 text-sm md:text-base"
          >
            {principle}
          </p>
        ))}
      </div>
    </section>
  );
}
