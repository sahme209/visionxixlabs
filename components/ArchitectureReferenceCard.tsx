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
    <article className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-5 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-base font-bold text-white mb-4">
        {architecture.title}
      </h3>
      <dl className="space-y-3">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-0.5">
              {label}
            </dt>
            <dd className="text-sm text-zinc-300">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
