import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      ["Explore V19", "/product"],
      ["Integrations", "/integrations"],
      ["Apps & Skills guide", "/docs/plugins"],
      ["Access and pricing", "/plans"],
      ["Download", "/download"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["Product demos", "/demo"],
      ["Documentation", "/docs"],
      ["Getting started", "/docs/getting-started"],
      ["Resources", "/resources"],
      ["Desktop updates", "/docs/desktop-install#updates"],
    ],
  },
  {
    title: "Developers",
    links: [
      ["API keys", "/docs/api-keys"],
      ["MCP tools", "/docs/mcp-tools"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Troubleshooting", "/docs/troubleshooting"],
      ["Account support (sign-in required)", "/account/help"],
      ["Contact", "/contact"],
    ],
  },
  {
    title: "Company",
    links: [["Founding Supporters", "/support"]],
  },
  {
    title: "Trust",
    links: [
      ["Security", "/security"],
      ["Trust center", "/trust"],
    ],
  },
] as const;

const footerLink = "inline-flex min-h-11 items-center rounded-sm py-1 text-sm leading-snug text-zinc-400 hover:text-white hover:underline focus-visible:text-white sm:min-h-7 [@media(pointer:coarse)]:min-h-11";

export function Footer({showCta = true}: {showCta?: boolean} = {}) {
  return (
    <>
      {showCta && (
        <section className="mx-auto flex max-w-[1280px] flex-col gap-4 px-5 pb-10 pt-8 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10" aria-labelledby="footer-cta-heading">
          <h2 id="footer-cta-heading" className="text-2xl font-medium tracking-tight text-zinc-100">Engineering intent, under control.</h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/product" prefetch={false} className="inline-flex min-h-11 items-center rounded-full bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 hover:bg-white">Explore V19</Link>
            <Link href="/support" prefetch={false} className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-zinc-300 hover:text-white hover:underline">Founding Supporters</Link>
          </div>
        </section>
      )}

      <footer className="site-footer px-5 pb-20 pt-10 sm:px-8 sm:pt-12 lg:px-10 lg:pt-14">
        <div className="mx-auto max-w-[1200px]">
          <nav aria-label="Footer navigation" className="grid grid-cols-2 items-start gap-x-6 gap-y-7 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-7">
            {columns.map((column) => (
              <div key={column.title} className="min-w-0">
                <h2 className="mb-1 text-sm font-medium text-zinc-200">{column.title}</h2>
                <ul>
                  {column.links.map(([label, href]) => (
                    <li key={href}><Link href={href} prefetch={false} className={footerLink}>{label}</Link></li>
                  ))}
                </ul>
                {column.title === "Company" && <p className="mt-2 max-w-[19ch] text-xs leading-relaxed text-zinc-400">We also build iOS applications.</p>}
              </div>
            ))}
          </nav>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 pt-4 sm:mt-10">
            <div className="flex flex-wrap items-center gap-x-4">
              <Link href="/" prefetch={false} aria-label="Vision XIX Labs home" className="inline-flex min-h-11 shrink-0 items-center rounded-sm">
                <Image src="/brand/vxix-wordmark.svg" alt="" width={103} height={26} />
              </Link>
              <p className="text-xs text-zinc-400">Vision XIX Labs © {new Date().getFullYear()}</p>
            </div>
            <nav aria-label="Footer utilities" className="flex w-full flex-wrap items-center gap-x-4 sm:w-auto sm:gap-x-6">
              <Link href="/status" prefetch={false} className={footerLink}>Service status</Link>
              <Link href="/privacy" prefetch={false} className={footerLink}>Privacy</Link>
              <Link href="/terms" prefetch={false} className={footerLink}>Terms</Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
