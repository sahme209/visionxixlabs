import Link from "next/link";
import type { SecurityService } from "@/lib/cloudSecurityContent";

type SecurityServiceCardProps = SecurityService & {
  ctaHref?: string;
  ctaLabel?: string;
};

export function SecurityServiceCard({
  name,
  description,
  includes,
  bestFor,
  ctaHref = "/contact",
  ctaLabel = "Discuss this service",
}: SecurityServiceCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm flex flex-col h-full">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        {name}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        {description}
      </p>
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
          Includes
        </p>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {includes.map((item) => (
            <li key={item} className="flex items-start">
              <span className="text-indigo-500 mr-2 mt-0.5 shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-auto text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          Best for:
        </span>{" "}
        {bestFor}
      </p>
      <div className="mt-4">
        <Link
          href={ctaHref}
          className="inline-flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
