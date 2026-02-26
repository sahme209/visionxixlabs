"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MagnifyingGlassIcon, DocumentTextIcon, BookOpenIcon, WrenchScrewdriverIcon, QuestionMarkCircleIcon } from "@heroicons/react/24/outline";
import { searchSite, SearchResult } from "@/lib/search-index";
import CardContainer from "@/components/CardContainer";
import { HERO_IMAGES, EMPTY_STATE_IMAGES } from "@/lib/images";

const categoryIcons: Record<SearchResult["category"], React.ComponentType<{ className?: string }>> = {
  page: DocumentTextIcon,
  resource: WrenchScrewdriverIcon,
  tool: WrenchScrewdriverIcon,
  help: QuestionMarkCircleIcon,
  guide: BookOpenIcon,
};

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const query = q.trim();
    setResults(query ? searchSite(query) : []);
  }, [q, mounted]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2">Search VisaNova</h1>
          <p className="text-sm text-white/90">Find pages, guides, tools, and help topics across the site</p>
        </div>
      </div>
    <CardContainer className="py-6 sm:py-8">
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 w-full min-w-0">

        {/* Search form - mirrors nav */}
        <form action="/search" method="get" className="mb-8">
          <div className="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search anything..."
              className="flex-1 min-w-0 px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] bg-transparent border-0 focus:outline-none focus:ring-0"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-3 bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] text-white shrink-0"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
          </div>
        </form>

        {/* Results */}
        {!q.trim() ? (
          <div className="rounded-xl card-see-through border border-[var(--border-color)]/50 overflow-hidden relative">
            <div className="absolute inset-0 opacity-[0.06]">
              <Image src={EMPTY_STATE_IMAGES.search} alt="" fill className="object-cover" sizes="800px" />
            </div>
            <div className="relative p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Enter a search term to find pages, guides, and help topics</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2">Try: I-130, processing times, interview, fees, status</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl card-see-through border border-[var(--border-color)]/50 overflow-hidden relative">
            <div className="absolute inset-0 opacity-[0.06]">
              <Image src={EMPTY_STATE_IMAGES.search} alt="" fill className="object-cover" sizes="800px" />
            </div>
            <div className="relative p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">No results for &quot;{q}&quot;</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2">
                Try different keywords or browse the <Link href="/help" className="text-[var(--text-primary)] hover:underline">Help Center</Link> or <Link href="/resources" className="text-[var(--text-primary)] hover:underline">Resources</Link>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((item) => {
              const Icon = categoryIcons[item.category];
              return (
                <Link
                  key={item.path + item.title}
                  href={item.path}
                  className="flex items-start gap-3 p-3 sm:p-4 rounded-xl card-see-through border border-[var(--border-color)]/50 hover:border-[var(--uscis-blue)]/40 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--uscis-blue)]/20 transition-colors">
                    <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      {item.title}
                    </p>
                    <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] shrink-0">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </CardContainer>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <CardContainer className="py-8">
        <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 w-full min-w-0 animate-pulse">
          <div className="h-6 bg-[var(--bg-surface-alt)] rounded w-1/3 mb-4" />
          <div className="h-10 bg-[var(--bg-surface-alt)] rounded mb-8" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[var(--bg-surface-alt)] rounded-xl" />
            ))}
          </div>
        </div>
      </CardContainer>
    }>
      <SearchContent />
    </Suspense>
  );
}
