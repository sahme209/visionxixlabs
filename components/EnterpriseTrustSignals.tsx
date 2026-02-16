import {
  CpuChipIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";
import {
  engineeringPrinciples,
  securityCommitmentItems,
  deliveryDisciplineItems,
} from "@/lib/engineeringContent";

const sectionConfig = [
  {
    id: "engineering-principles",
    title: "Engineering principles",
    icon: CpuChipIcon,
    items: engineeringPrinciples,
  },
  {
    id: "security-commitment",
    title: "Security commitment",
    icon: ShieldCheckIcon,
    items: securityCommitmentItems,
  },
  {
    id: "delivery-discipline",
    title: "Delivery discipline",
    icon: DocumentCheckIcon,
    items: deliveryDisciplineItems,
  },
];

export function EnterpriseTrustSignals() {
  return (
    <section
      className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
      aria-labelledby="trust-signals-heading"
    >
      <div className="max-w-6xl mx-auto">
        <h2
          id="trust-signals-heading"
          className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-8 text-center"
        >
          How we operate
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {sectionConfig.map((block) => {
            const Icon = block.icon;
            return (
              <div
                key={block.id}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {block.title}
                  </h3>
                </div>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
