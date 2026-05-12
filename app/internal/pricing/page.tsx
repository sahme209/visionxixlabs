import { notFound } from "next/navigation";
import { pricingTiersInternal } from "@/lib/pricingTiersInternal";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

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
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-8 font-sans relative overflow-hidden">
      {/* Background effects */}
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20 pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto">
        <Reveal direction="up" blur delay={0.05}>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">
            Internal <span className="text-gradient">pricing tiers</span>
          </h1>
          <p className="text-zinc-400 text-sm mb-8">
            For your reference only. Not linked from the site. Edit in{" "}
            <code className="text-violet-400 bg-white/[0.04] px-1.5 py-0.5 rounded text-xs">lib/pricingTiersInternal.ts</code>.
          </p>
        </Reveal>

        <div className="section-divider mb-8" />

        <div className="space-y-6">
          <Stagger delay={0.1} interval={0.08}>
            {pricingTiersInternal.map((tier) => (
              <div
                key={tier.id}
                className="glass-card card-hover animated-border card-inner-glow rounded-2xl p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h2 className="text-lg font-semibold text-white tracking-[-0.04em]">{tier.name}</h2>
                  <span className="text-sm font-medium text-violet-400">{tier.price}</span>
                </div>
                <p className="text-zinc-400 text-sm mb-3">{tier.duration} · {tier.bestFor}</p>
                <ul className="text-sm text-zinc-300 space-y-1">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-violet-400 mt-0.5">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                {tier.notes && (
                  <p className="text-zinc-500 text-xs mt-3">{tier.notes}</p>
                )}
              </div>
            ))}
          </Stagger>
        </div>
      </div>
    </div>
  );
}
