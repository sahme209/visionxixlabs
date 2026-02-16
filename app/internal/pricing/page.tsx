import { notFound } from "next/navigation";
import { pricingTiersInternal } from "@/lib/pricingTiersInternal";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ key?: string }> };

export default async function InternalPricingPage({ searchParams }: Props) {
  const params = await searchParams;
  const key = params?.key;
  const secret = process.env.INTERNAL_PRICING_KEY;

  if (!secret || key !== secret) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Internal pricing tiers</h1>
        <p className="text-slate-400 text-sm mb-8">
          For your reference only. Not linked from the site. Edit in{" "}
          <code className="text-slate-300">lib/pricingTiersInternal.ts</code>.
        </p>
        <div className="space-y-6">
          {pricingTiersInternal.map((tier) => (
            <div
              key={tier.id}
              className="rounded-lg border border-slate-700 bg-slate-800/50 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <h2 className="text-lg font-semibold text-white">{tier.name}</h2>
                <span className="text-sm font-medium text-indigo-400">{tier.price}</span>
              </div>
              <p className="text-slate-400 text-sm mb-3">{tier.duration} · {tier.bestFor}</p>
              <ul className="text-sm text-slate-300 space-y-1">
                {tier.includes.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
              {tier.notes && (
                <p className="text-slate-500 text-xs mt-3">{tier.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
