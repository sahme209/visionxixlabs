import Link from "next/link";
import {
    ArrowDownTrayIcon,
    ArrowLeftIcon,
    HomeIcon,
} from "@heroicons/react/24/outline";

export function SandboxNavigation() {
    return (
        <nav
            aria-label="Sandbox navigation"
            className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#09090b]/95 backdrop-blur-xl"
        >
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-brand-coral"
                >
                    <HomeIcon className="h-4 w-4" />
                    Vision XIX Labs
                </Link>

                <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="hidden rounded-full border border-brand-coral/25 bg-brand-coral/[0.06] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-brand-coral sm:inline-flex">
                        Product sandbox · sample data
                    </span>
                    <Link
                        href="/demo"
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/[0.20] hover:text-white"
                    >
                        <ArrowLeftIcon className="h-3.5 w-3.5" />
                        Sandbox home
                    </Link>
                    <Link
                        href="/download"
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
                    >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        Download app
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white"
                    >
                        Exit sandbox
                    </Link>
                </div>
            </div>
        </nav>
    );
}
