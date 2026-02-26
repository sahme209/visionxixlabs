"use client";

import { useState, useEffect, useMemo } from "react";
import { NewsArticle, ArticlePriority } from "@/lib/types/news";
import { newsService } from "@/lib/services/newsService";
import Image from "next/image";
import {
  NewspaperIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

// Placeholder gradient based on article - consistent per title
function getPlaceholderGradient(title: string): string {
  const hash = title.split("").reduce((a, c) => (a + c.charCodeAt(0)) % 6, 0);
  const gradients = [
    "from-blue-600 to-indigo-700",
    "from-emerald-600 to-teal-700",
    "from-violet-600 to-purple-700",
    "from-orange-500 to-rose-500",
    "from-rose-600 to-pink-600",
    "from-cyan-600 to-blue-600",
  ];
  return gradients[hash];
}

import { HERO_IMAGES, NEWS_IMAGES, NEWS_IMAGES_POOL, SOURCE_IMAGES, BOUNDLESS_WEEKLY_IMAGE, EMPTY_STATE_IMAGES } from "@/lib/images";

/** Topic-to-image pools — each topic has 2–3 options for variety */
const TOPIC_POOLS: Record<string, readonly string[]> = {
  law: [NEWS_IMAGES.law, NEWS_IMAGES.documents],
  embassy: [NEWS_IMAGES.embassy, NEWS_IMAGES.capitol],
  visa: [NEWS_IMAGES.visa, NEWS_IMAGES.passport, NEWS_IMAGES.statueOfLiberty],
  official: [NEWS_IMAGES.official, NEWS_IMAGES.capitol, NEWS_IMAGES.documents],
  professional: [NEWS_IMAGES.professional, NEWS_IMAGES.documents],
  citizenship: [NEWS_IMAGES.citizenship, NEWS_IMAGES.statueOfLiberty, NEWS_IMAGES.usFlag],
  travel: [NEWS_IMAGES.travel, NEWS_IMAGES.airplane, NEWS_IMAGES.airport],
  passport: [NEWS_IMAGES.passport, NEWS_IMAGES.travel],
  family: [NEWS_IMAGES.family, NEWS_IMAGES.citizenship],
};

/** Returns immigration/travel/USCIS-themed image. Each article gets a different image via index. */
function getImageForHeadline(title: string, index: number): string {
  const t = title.toLowerCase();
  if (t.includes("this week in immigration") || (t.includes("boundless") && t.includes("immigration"))) {
    return BOUNDLESS_WEEKLY_IMAGE;
  }
  let pool: readonly string[] | undefined;
  if (t.includes("fraud") || t.includes("arrest") || t.includes("investigation")) pool = TOPIC_POOLS.law;
  else if (t.includes("visa bulletin") || t.includes("nvc") || t.includes("consular")) pool = TOPIC_POOLS.embassy;
  else if (t.includes("visa") || t.includes("green card") || t.includes("i-130") || t.includes("i-485") || t.includes("adjustment")) pool = TOPIC_POOLS.visa;
  else if (t.includes("dhs") || t.includes("uscis") || t.includes("forms") || t.includes("processing") || t.includes("official")) pool = TOPIC_POOLS.official;
  else if (t.includes("ice") || t.includes("detention") || t.includes("deportation") || t.includes("law")) pool = TOPIC_POOLS.law;
  else if (t.includes("tps") || t.includes("temporary") || t.includes("protection") || t.includes("asylum") || t.includes("refugee")) pool = TOPIC_POOLS.professional;
  else if (t.includes("citizenship") || t.includes("naturalization")) pool = TOPIC_POOLS.citizenship;
  else if (t.includes("travel ban") || t.includes("flight") || t.includes("airport") || t.includes("airline")) pool = TOPIC_POOLS.travel;
  else if (t.includes("passport") || t.includes("travel.gov") || t.includes("step")) pool = TOPIC_POOLS.passport;
  else if (t.includes("embassy") || t.includes("consulate") || t.includes("interview")) pool = TOPIC_POOLS.embassy;
  else if (t.includes("work permit") || t.includes("ead") || t.includes("i-765")) pool = TOPIC_POOLS.official;
  else if (t.includes("family") || t.includes("reunion")) pool = TOPIC_POOLS.family;
  else if (t.includes("travel")) pool = TOPIC_POOLS.travel;
  if (pool) return pool[index % pool.length];
  return NEWS_IMAGES_POOL[index % NEWS_IMAGES_POOL.length];
}

/** Google/redirect image URLs often block hotlinking — skip for img src */
function isUnreliableImageUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.includes("google") || h.includes("googleusercontent") || h.includes("gstatic");
  } catch {
    return false;
  }
}

/** Extract source name and image from article URL */
function getSourceInfo(url: string): { name: string; image: string } | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const image = SOURCE_IMAGES[host] || SOURCE_IMAGES[`www.${host}`];
    if (!image) return null;
    const name = host.split(".").slice(-2, -1)[0] || host;
    return { name: name.charAt(0).toUpperCase() + name.slice(1), image };
  } catch {
    return null;
  }
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<0 | 1 | 2>(0);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const loadInitialNews = async () => {
      if (news.length === 0) setIsLoading(true);
      try {
        const fetchedNews = await newsService.fetchLatestNews();
        setNews(fetchedNews);
      } catch (error) {
        console.error("Error loading news:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialNews();
    const checkRefresh = async () => {
      const lastFetch = localStorage.getItem("lastNewsFetchDate");
      if (lastFetch) {
        const hoursSinceFetch = Math.floor(
          (Date.now() - new Date(lastFetch).getTime()) / (1000 * 60 * 60)
        );
        if (hoursSinceFetch >= 6) await refreshNews();
      }
    };
    checkRefresh();
  }, []);

  const refreshNews = async () => {
    setIsRefreshing(true);
    try {
      const fetchedNews = await newsService.fetchLatestNews(true);
      setNews(fetchedNews);
    } catch (error) {
      console.error("Error refreshing news:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const displayedNews = useMemo(() => {
    let filtered = news;
    if (selectedFilter === 1) filtered = filtered.filter((a) => a.priority === ArticlePriority.Breaking);
    else if (selectedFilter === 2) filtered = filtered.filter((a) => a.priority === ArticlePriority.Urgent);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [news, selectedFilter, searchText]);

  const breakingCount = news.filter((a) => a.priority === ArticlePriority.Breaking).length;
  const urgentCount = news.filter((a) => a.priority === ArticlePriority.Urgent).length;
  const featured = displayedNews[0];
  const rest = displayedNews.slice(1);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.passport}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 113, 227, 0.2) 0%, transparent 50%)" }} />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" />
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shadow-lg">
                <NewspaperIcon className="w-7 h-7 text-white" />
              </div>
              <div style={{ color: "#ffffff" }} className="hero-text-white">
                <h1 className="text-2xl sm:text-3xl font-bold !text-white" style={{ color: "#ffffff" }}>
                  Immigration News
                </h1>
                <p className="text-sm mt-0.5 !text-white" style={{ color: "#ffffff" }}>
                  Curated updates from trusted sources—stay ahead without scouring multiple sites
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider !text-white" style={{ color: "#ffffff" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden />
                    Live
                  </span>
                  <span className="text-[10px] !text-white" style={{ color: "#ffffff" }}>
                    From trusted government and news sources
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={refreshNews}
              disabled={isRefreshing}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-200 disabled:opacity-50"
              aria-label="Refresh"
            >
              <svg
                className={`w-5 h-5 text-white ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <div className="rounded-xl border border-[var(--uscis-blue)]/20 bg-[var(--uscis-blue)]/5 p-4 mb-6">
          <p className="text-sm text-[var(--text-secondary)]">
            News from trusted government and news sources. Refreshed regularly—use the refresh button for the latest.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-md p-4 sm:p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search news..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
              />
            </div>
            <div className="flex gap-2 p-1 rounded-xl bg-[var(--bg-surface-alt)]">
              <button
                onClick={() => setSelectedFilter(0)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  selectedFilter === 0 ? "bg-[var(--uscis-blue)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                All ({news.length})
              </button>
              <button
                onClick={() => setSelectedFilter(1)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  selectedFilter === 1 ? "bg-red-600 text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Breaking {breakingCount > 0 && `(${breakingCount})`}
              </button>
              <button
                onClick={() => setSelectedFilter(2)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  selectedFilter === 2 ? "bg-orange-500 text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Urgent {urgentCount > 0 && `(${urgentCount})`}
              </button>
            </div>
          </div>
        </div>

        {isLoading && news.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-[var(--uscis-blue)] border-t-transparent rounded-full animate-spin" />
              <p className="text-[var(--text-secondary)]">Loading news...</p>
            </div>
          </div>
        ) : displayedNews.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-16 text-center overflow-hidden relative">
            <div className="absolute inset-0 opacity-[0.06]">
              <Image src={EMPTY_STATE_IMAGES.news} alt="" fill className="object-cover" sizes="800px" />
            </div>
            <div className="relative">
              <NewspaperIcon className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
              <p className="text-lg font-medium text-[var(--text-primary)] mb-2">
                {searchText ? "No matches" : "No news yet"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {searchText ? "Try a different search." : "News will appear as it becomes available."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Featured / Hero Card */}
            {featured && (
              <NewsCard
                article={featured}
                index={0}
                isRefreshing={isRefreshing}
                featured
              />
            )}
            {/* Rest - Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {rest.map((article, i) => (
                <NewsCard
                  key={article.id}
                  article={article}
                  index={i + 1}
                  isRefreshing={isRefreshing}
                  featured={false}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function NewsCard({
  article,
  index,
  isRefreshing,
  featured,
}: {
  article: NewsArticle;
  index: number;
  isRefreshing: boolean;
  featured: boolean;
}) {
  const isBreaking = article.priority === ArticlePriority.Breaking;
  const isUrgent = article.priority === ArticlePriority.Urgent;
  const gradient = getPlaceholderGradient(article.title);
  const sourceInfo = getSourceInfo(article.url);

  const handleOpen = () => {
    window.open(article.url, "_blank", "noopener,noreferrer");
  };

  const [imgError, setImgError] = useState(false);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [useFallbackImage, setUseFallbackImage] = useState(false);
  useEffect(() => {
    setImgError(false);
    setOgImageUrl(null);
    setUseFallbackImage(false);
  }, [article.id, article.title]);
  // Fetch OG image for featured top news when RSS has no reliable image
  useEffect(() => {
    if (!featured || (article.imageUrl && !isUnreliableImageUrl(article.imageUrl))) return;
    let mounted = true;
    fetch(`/api/news/og-image?url=${encodeURIComponent(article.url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (mounted && data?.imageUrl) setOgImageUrl(data.imageUrl);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [featured, article.url, article.imageUrl]);
  const reliableArticleImage = article.imageUrl && !isUnreliableImageUrl(article.imageUrl) ? article.imageUrl : null;
  const primaryImageSrc = reliableArticleImage || ogImageUrl;
  const fallbackImageSrc = getImageForHeadline(article.title, index);
  const imageSrc = (primaryImageSrc && !useFallbackImage) ? primaryImageSrc : fallbackImageSrc;
  const showImage = !imgError;

  const handleImageError = () => {
    if (primaryImageSrc && !useFallbackImage) {
      setUseFallbackImage(true);
      setImgError(false);
    } else {
      setImgError(true);
    }
  };

  const imageArea = (
    <div className="relative w-full aspect-[16/9] overflow-hidden rounded-t-2xl sm:rounded-l-2xl sm:rounded-t-none bg-gradient-to-br from-[var(--uscis-blue)]/20 to-indigo-900/20">
      {/* Base: topic image always shown first so we never show placeholder */}
      <img
        src={fallbackImageSrc}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover ${!primaryImageSrc || useFallbackImage || imgError ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!!primaryImageSrc && !useFallbackImage && !imgError}
        onError={() => setImgError(true)}
      />
      {/* Overlay: article/OG image when available and loading */}
      {primaryImageSrc && !useFallbackImage && (
        <img
          key={primaryImageSrc}
          src={primaryImageSrc}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${showImage ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImgError(false)}
          onError={handleImageError}
        />
      )}
      <div
        className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient} ${showImage ? "opacity-0" : "opacity-100"} pointer-events-none`}
      >
        <NewspaperIcon className="w-16 h-16 text-white/60" />
      </div>
      {(isBreaking || isUrgent) && (
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
              isBreaking ? "bg-red-600 text-white" : "bg-orange-500 text-white"
            }`}
          >
            <BoltIcon className="w-3 h-3" />
            {isBreaking ? "Breaking" : "Urgent"}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <button
      onClick={handleOpen}
      disabled={isRefreshing}
      className={`text-left w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-md hover:shadow-xl hover:shadow-[var(--uscis-blue)]/8 hover:border-[var(--uscis-blue)]/40 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group disabled:opacity-70 ${
        featured ? "sm:flex" : ""
      }`}
    >
      {featured ? (
        <>
          <div className="w-full sm:w-1/2 sm:min-w-[280px] flex-shrink-0">{imageArea}</div>
          <div className="flex-1 min-w-0 p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] mb-2 flex-wrap">
              {sourceInfo && (
                <span className="inline-flex items-center gap-1.5 pr-2 border-r border-[var(--border-color)]">
                  <img src={sourceInfo.image} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-[var(--border-color)]" />
                  <span className="font-medium text-[var(--text-secondary)]">{sourceInfo.name}</span>
                </span>
              )}
              <span>{article.date}</span>
              {article.readingTime > 0 && <span>•</span>}
              {article.readingTime > 0 && <span>{article.readingTime} min read</span>}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors line-clamp-2 mb-2">
              {article.title}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] line-clamp-3 mb-4">
              {article.summary}
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              Read full article
              <ArrowTopRightOnSquareIcon className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col">
          {imageArea}
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-tertiary)] mb-1.5 flex-wrap">
              {sourceInfo && (
                <span className="inline-flex items-center gap-1 pr-2 border-r border-[var(--border-color)]">
                  <img src={sourceInfo.image} alt="" className="w-4 h-4 rounded-full object-cover ring-1 ring-[var(--border-color)]" />
                  <span className="font-medium text-[var(--text-secondary)]">{sourceInfo.name}</span>
                </span>
              )}
              <span>{article.date}</span>
              {article.readingTime > 0 && (
                <>
                  <span>•</span>
                  <span>{article.readingTime} min</span>
                </>
              )}
            </div>
            <h3 className="font-bold text-[var(--text-primary)] line-clamp-2 mb-1.5 group-hover:text-[var(--text-secondary)] transition-colors">
              {article.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">
              {article.summary}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)]">
              Read
              <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </span>
          </div>
        </div>
      )}
    </button>
  );
}
