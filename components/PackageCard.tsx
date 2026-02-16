"use client";

type PackageCardProps = {
  name: string;
  duration: string;
  includes: string[];
  bestFor: string;
};

export function PackageCard({
  name,
  duration,
  includes,
  bestFor,
}: PackageCardProps) {
  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {name}
        </h3>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
          {duration}
        </span>
      </div>
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Includes
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
          {includes.map((item) => (
            <li key={item}>{item}</li>
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
        <button
          type="button"
          className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          Talk to us
        </button>
      </div>
    </div>
  );
}

