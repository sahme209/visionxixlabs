"use client";

import { useState } from "react";

type CloudProviderTabsProps = {
  awsBullets: string[];
  azureBullets: string[];
};

export function CloudProviderTabs({
  awsBullets,
  azureBullets,
}: CloudProviderTabsProps) {
  const [active, setActive] = useState<"aws" | "azure">("aws");

  return (
    <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setActive("aws")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              active === "aws"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            AWS
          </button>
          <button
            type="button"
            onClick={() => setActive("azure")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              active === "azure"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Azure
          </button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            What we do on AWS
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {awsBullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
            What we do on Azure
          </h3>
          <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {azureBullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
        Use the tabs above to focus on AWS or Azure details while keeping a
        consistent delivery approach.
      </p>
    </div>
  );
}

