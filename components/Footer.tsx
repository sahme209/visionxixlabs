import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      ["Axiom Agent", "/product"],
      ["Product tour", "/demo"],
      ["Integrations", "/integrations"],
      ["Pricing", "/plans"],
      ["Security", "/security"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/axiom"],
      ["Founding Supporters", "/support"],
      ["Contact", "/contact"],
      ["Service status", "/status"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Security", "/security"],
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="site-footer border-t border-white/[0.07] bg-[#090a08] px-5 pb-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1400px]">
        <section className="flex flex-col gap-8 border-b border-white/[0.07] py-16 md:flex-row md:items-end md:justify-between lg:py-20" aria-labelledby="footer-cta-heading">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-orange-300">Axiom Agent</p>
            <h2 id="footer-cta-heading" className="mt-4 max-w-3xl text-3xl font-medium leading-tight tracking-[-0.045em] text-zinc-100 sm:text-5xl">Engineering intent, under control.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/product" className="rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-white">Explore Axiom</Link>
            <Link href="/support" className="rounded-full border border-orange-300/30 px-5 py-3 text-sm font-medium text-orange-200 transition hover:border-orange-300/60 hover:bg-orange-300/[0.06]">Support Axiom</Link>
          </div>
        </section>

        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(3,1fr)] lg:gap-10">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-semibold text-zinc-100">
              <Image src="/vision-xix-logo.png" alt="" width={28} height={28} className="rounded-md" />
              Vision XIX Labs
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">Axiom Agent brings AI assistance, human authorization, execution, and evidence into one governed engineering workflow.</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">We also build iOS applications.</p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs text-zinc-600">{column.title}</h3>
              <ul className="mt-5 space-y-3">
                {column.links.map(([label, href]) => (
                  <li key={href}><Link href={href} className="text-sm text-zinc-400 transition-colors hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center gap-4 border-t border-white/[0.07] pt-7 text-xs text-zinc-600 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Vision XIX Labs. All rights reserved.</p>
          <p>Production access is service-verified. Demonstrations are clearly labeled.</p>
        </div>
      </div>
    </footer>
  );
}
