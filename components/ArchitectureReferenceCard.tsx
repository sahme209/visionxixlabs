import type { ReferenceArchitecture } from "@/lib/caseStudiesContent";

type ArchitectureReferenceCardProps = {
  architecture: ReferenceArchitecture;
};

export function ArchitectureReferenceCard({
  architecture,
}: ArchitectureReferenceCardProps) {
  const rows = [
    { label: "Core components", value: architecture.coreComponents },
    { label: "Access model", value: architecture.accessModel },
    { label: "Deployment method", value: architecture.deploymentMethod },
    { label: "Observability layer", value: architecture.observabilityLayer },
    { label: "Cost control approach", value: architecture.costControlApproach },
  ];

  return (
    <article className="surface-glass rounded-xl p-6 hover:border-brand-coral/20 transition-all">
      <h3 className="font-display text-base font-bold text-white mb-5 tracking-tight">
        {architecture.title}
      </h3>
      <dl className="space-y-4">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="mono-label mb-1 text-brand-coral/75">
              {label}
            </dt>
            <dd className="text-[13.5px] text-zinc-300 leading-relaxed">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
