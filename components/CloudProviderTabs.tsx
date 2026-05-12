"use client";

import { useState } from "react";

type CloudProviderTabsProps = {
  awsBullets: string[];
  azureBullets: string[];
  gcpBullets: string[];
};

export function CloudProviderTabs({
  awsBullets,
  azureBullets,
  gcpBullets,
}: CloudProviderTabsProps) {
  const [active, setActive] = useState<"aws" | "azure" | "gcp">("aws");

  return (
    <div className="card-hover bg-white/[0.02] rounded-2xl p-6 shadow-xl border border-white/[0.06]">
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-full bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setActive("aws")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              active === "aws"
                ? "bg-white/[0.06] text-white shadow-sm"
                : "text-zinc-500"
            }`}
          >
            AWS
          </button>
          <button
            type="button"
            onClick={() => setActive("azure")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              active === "azure"
                ? "bg-white/[0.06] text-white shadow-sm"
                : "text-zinc-500"
            }`}
          >
            Azure
          </button>
          <button
            type="button"
            onClick={() => setActive("gcp")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              active === "gcp"
                ? "bg-white/[0.06] text-white shadow-sm"
                : "text-zinc-500"
            }`}
          >
            GCP
          </button>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {active === "aws" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                What we do on AWS
              </h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                {awsBullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Unified approach
              </h3>
              <p className="text-sm text-zinc-400">
                We apply consistent patterns across AWS, Azure, and GCP while respecting each provider&apos;s unique strengths and services.
              </p>
            </div>
          </>
        )}
        {active === "azure" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                What we do on Azure
              </h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                {azureBullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Unified approach
              </h3>
              <p className="text-sm text-zinc-400">
                We apply consistent patterns across AWS, Azure, and GCP while respecting each provider&apos;s unique strengths and services.
              </p>
            </div>
          </>
        )}
        {active === "gcp" && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                What we do on GCP
              </h3>
              <ul className="text-sm text-zinc-400 space-y-1">
                {gcpBullets.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">
                Unified approach
              </h3>
              <p className="text-sm text-zinc-400">
                We apply consistent patterns across AWS, Azure, and GCP while respecting each provider&apos;s unique strengths and services.
              </p>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-zinc-500 text-center">
        Use the tabs above to focus on AWS, Azure, or GCP details while keeping a
        consistent delivery approach.
      </p>
    </div>
  );
}

