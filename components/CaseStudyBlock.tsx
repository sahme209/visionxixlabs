import type { CaseStudy } from "@/lib/caseStudiesContent";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

type CaseStudyBlockProps = {
  study: CaseStudy;
  index: number;
};

function Section({
  title,
  content,
  isList,
}: {
  title: string;
  content: string | string[];
  isList: boolean;
}) {
  const body = Array.isArray(content) ? content : [content];
  return (
    <details className="group border-b border-white/[0.06] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-left">
        <span className="text-sm font-semibold text-white">
          {title}
        </span>
        <ChevronDownIcon className="h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pl-0">
        {isList ? (
          <ul className="space-y-1.5 text-sm text-zinc-400">
            {body.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">{body[0]}</p>
        )}
      </div>
    </details>
  );
}

export function CaseStudyBlock({ study, index }: CaseStudyBlockProps) {
  return (
    <article
      className="bg-white/[0.02] rounded-2xl border border-white/[0.06] shadow-sm overflow-hidden"
      aria-labelledby={`case-study-${study.id}-title`}
    >
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold text-zinc-500">
            {String(index).padStart(2, "0")}
          </span>
          <h2
            id={`case-study-${study.id}-title`}
            className="text-xl font-bold text-white"
          >
            {study.title}
          </h2>
        </div>
      </div>
      <div className="px-6 py-4">
        <Section title="Context" content={study.context} isList={false} />
        <Section
          title="Technical Challenge"
          content={study.technicalChallenge}
          isList
        />
        <Section
          title="Architecture Approach"
          content={study.architectureApproach}
          isList
        />
        <Section
          title="Implementation Strategy"
          content={study.implementationStrategy}
          isList
        />
        <Section
          title="Operational Model"
          content={study.operationalModel}
          isList
        />
        <Section title="Deliverables" content={study.deliverables} isList />
        <Section title="Outcome" content={study.outcome} isList />
      </div>
    </article>
  );
}
