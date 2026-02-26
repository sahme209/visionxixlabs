"use client";

import { useState, useEffect, useMemo } from "react";
import { NewsArticle, ArticlePriority } from "@/lib/types/news";
import { newsService } from "@/lib/services/newsService";

interface NewsFeedSectionProps {
  className?: string;
}

export default function NewsFeedSection({ className = "" }: NewsFeedSectionProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<0 | 1 | 2>(0); // 0: All, 1: Breaking, 2: Urgent
  const [searchText, setSearchText] = useState("");

  // Load initial news
  useEffect(() => {
    const loadInitialNews = async () => {
      if (news.length === 0) {
        setIsLoading(true);
      }
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

    // Check if we should refresh (if cache is older than 6 hours)
    const checkRefresh = async () => {
      const lastFetch = localStorage.getItem("lastNewsFetchDate");
      if (lastFetch) {
        const lastFetchDate = new Date(lastFetch);
        const hoursSinceFetch = Math.floor((Date.now() - lastFetchDate.getTime()) / (1000 * 60 * 60));
        if (hoursSinceFetch >= 6) {
          await refreshNews();
        }
      }
    };

    checkRefresh();
  }, []);

  // Refresh news (force refresh)
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

  // Filter and search news
  const displayedNews = useMemo(() => {
    let filtered = news;

    // Apply filter
    if (selectedFilter === 1) {
      filtered = filtered.filter((article) => article.priority === ArticlePriority.Breaking);
    } else if (selectedFilter === 2) {
      filtered = filtered.filter((article) => article.priority === ArticlePriority.Urgent);
    }

    // Apply search
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (article) =>
          article.title.toLowerCase().includes(searchLower) ||
          article.summary.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [news, selectedFilter, searchText]);

  const breakingCount = news.filter((article) => article.priority === ArticlePriority.Breaking).length;
  const urgentCount = news.filter((article) => article.priority === ArticlePriority.Urgent).length;

  // Loading state
  if (isLoading && news.length === 0) {
    return (
      <div className={`uscis-card ${className}`}>
        <div className="p-6">
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[var(--uscis-blue)] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">Loading news...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="uscis-card">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Immigration News</h3>
            <button
              onClick={refreshNews}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors disabled:opacity-50"
              aria-label="Refresh news"
            >
              <svg
                className={`w-5 h-5 text-[var(--text-secondary)] ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          {/* Search Field */}
          <div className="mb-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search news..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] text-[var(--text-primary)]"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Filter Picker */}
          <div className="mb-4">
            <div className="flex gap-2 bg-[var(--bg-surface-alt)] p-1 rounded-lg">
              <button
                onClick={() => setSelectedFilter(0)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFilter === 0
                    ? "bg-[var(--uscis-blue)] text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedFilter(1)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFilter === 1
                    ? "bg-red-600 text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Breaking {breakingCount > 0 && `(${breakingCount})`}
              </button>
              <button
                onClick={() => setSelectedFilter(2)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFilter === 2
                    ? "bg-red-600 text-white"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Urgent {urgentCount > 0 && `(${urgentCount})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* News List */}
      {displayedNews.length === 0 ? (
        <div className="uscis-card">
          <div className="p-6 text-center py-12">
            <p className="text-[var(--text-secondary)]">
              {searchText ? "No news found matching your search." : "No news available."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedNews.map((article) => (
            <NewsCard key={article.id} article={article} isRefreshing={isRefreshing} />
          ))}
        </div>
      )}
    </div>
  );
}

// News Card Component - Matching iOS ModernNewsCard
function NewsCard({ article, isRefreshing }: { article: NewsArticle; isRefreshing: boolean }) {
  const priorityColors = {
    [ArticlePriority.Breaking]: "bg-red-600",
  [ArticlePriority.Urgent]: "bg-red-600",
    [ArticlePriority.Normal]: "bg-[var(--uscis-blue)]",
  };

  const priorityLabels = {
    [ArticlePriority.Breaking]: "BREAKING",
    [ArticlePriority.Urgent]: "URGENT",
    [ArticlePriority.Normal]: "NEWS",
  };

  const handleOpenArticle = () => {
    window.open(article.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="uscis-card">
      <div className="p-4">
        <div className="space-y-3">
          {/* Priority Badge and Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[article.priority]}`}></div>
              <span
                className={`text-xs font-bold ${
                  article.priority === ArticlePriority.Breaking
                    ? "text-red-600"
                    : article.priority === ArticlePriority.Urgent
                    ? "text-red-600"
                    : "text-[var(--text-primary)]"
                }`}
              >
                {priorityLabels[article.priority]}
              </span>
            </div>
            <span className="text-xs text-[var(--text-secondary)]">{article.date}</span>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-[var(--text-primary)] line-clamp-2">{article.title}</h3>

          {/* Summary */}
          <p className="text-sm text-[var(--text-secondary)] line-clamp-3">{article.summary}</p>

          {/* Read Button */}
          <button
            onClick={handleOpenArticle}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-1.5 bg-[var(--uscis-blue)] text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
          >
            Read Full Article
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
