import Link from "next/link";

const links = [
    { href: "/demo", label: "Sandbox demo" },
    { href: "/docs", label: "Documentation" },
    { href: "/plans", label: "Access and pricing" },
    { href: "/contact", label: "Contact" },
    { href: "/security", label: "Security" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
] as const;

export function Footer() {
    return (
        <footer className="border-t border-white/[0.07] px-5 py-12 sm:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="font-semibold text-white">TAURI by Vision XIX Labs</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">A web application for governed deployment operations. Product availability is stated explicitly; sandbox data is fictional.</p>
                </div>
                <nav className="flex max-w-xl flex-wrap gap-x-5 gap-y-3" aria-label="Footer navigation">
                    {links.map((link) => <Link key={link.href} href={link.href} className="text-sm text-zinc-500 hover:text-white">{link.label}</Link>)}
                </nav>
            </div>
        </footer>
    );
}
