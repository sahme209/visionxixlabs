import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      ["Deployment operations", "/product"],
      ["Capabilities", "/capabilities"],
      ["Integrations", "/integrations"],
      ["Plans", "/plans"],
      ["Desktop app", "/download"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Documentation", "/resources"],
      ["Getting started", "/docs/getting-started"],
      ["Security model", "/docs/security-model"],
      ["Release readiness", "/docs/releaseops/readiness"],
      ["Service status", "/status"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/axiom"],
      ["Principles", "/principles"],
      ["Case studies", "/case-studies"],
      ["Support", "/contact"],
      ["Founding Supporters", "/support"],
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
    <footer className="site-footer border-t border-white/[0.07] bg-[#090a08] px-5 pb-8 pt-20 sm:px-8 lg:px-12 lg:pt-24">
      <div className="mx-auto max-w-[1400px]">
        <section className="border-b border-white/[0.07] pb-20 text-center lg:pb-24" aria-labelledby="footer-cta-heading">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-orange-300">Axiom Agent</p>
          <h2 id="footer-cta-heading" className="mx-auto mt-5 max-w-5xl text-4xl font-medium leading-[0.98] tracking-[-0.055em] text-zinc-100 sm:text-6xl lg:text-7xl">Turn engineering intent into governed action.</h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-zinc-400">Start with the product tour, then bring Axiom into the engineering workspace when you are ready.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/download" className="rounded-full bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-white">Download Axiom</Link>
            <Link href="/demo" className="rounded-full border border-white/[0.14] px-6 py-3 text-sm text-zinc-200 hover:bg-white/[0.05]">Explore the product</Link>
          </div>
        </section>

        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:gap-8 lg:py-20">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-semibold text-zinc-100">
              <Image src="/vision-xix-logo.png" alt="" width={28} height={28} className="rounded-md" />
              Vision XIX Labs
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">Axiom Agent brings AI assistance, human authorization, execution, and evidence into one governed engineering workflow.</p>
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

        <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-7 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vision XIX Labs. All rights reserved.</p>
          <p>Production access is service-verified. Demonstrations are clearly labeled.</p>
        </div>
      </div>
    </footer>
  );
}
