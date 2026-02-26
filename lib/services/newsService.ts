// News Service - Exact port of iOS NewsService.swift
// Fetches immigration news from multiple RSS sources with 12-hour caching

import { NewsArticle, ArticlePriority, RSSItem } from "@/lib/types/news";

const LAST_FETCH_DATE_KEY = "lastNewsFetchDate";
const CACHED_NEWS_KEY = "cachedNews";

class NewsService {
  private static instance: NewsService;

  private constructor() {}

  static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  /**
   * Fetches latest news from the internet
   * @param forceRefresh If true, bypasses cache and fetches fresh news
   * @returns Array of news articles
   */
  async fetchLatestNews(forceRefresh: boolean = false): Promise<NewsArticle[]> {
    // Check if we already fetched today (unless forcing refresh)
    if (!forceRefresh) {
      const lastFetch = this.getLastFetchDate();
      const cached = this.loadCachedNews();

      if (lastFetch && cached && cached.length > 0) {
        const isToday = this.isDateInToday(lastFetch);
        if (isToday) {
          // Check if cache is stale (older than 12 hours)
          const hoursSinceFetch = this.getHoursSince(lastFetch);
          if (hoursSinceFetch < 12) {
            return cached;
          }
          // If cache is older than 12 hours, fetch fresh in background, return cached immediately
          this.fetchLatestNews(true).catch(console.error);
          return cached;
        }
      }
    }

    // Fetch from multiple sources concurrently
    const [uscisNews, dhsNews, googleNews, travelStateNews] = await Promise.allSettled([
      this.fetchUSCISNews(),
      this.fetchDHSNews(),
      this.fetchGoogleNews(),
      this.fetchTravelStateNews(),
    ]);

    let allNews: NewsArticle[] = [];

    // Combine results (ignore rejected promises)
    if (uscisNews.status === "fulfilled" && uscisNews.value.length > 0) {
      allNews.push(...uscisNews.value);
    }
    if (dhsNews.status === "fulfilled" && dhsNews.value.length > 0) {
      allNews.push(...dhsNews.value);
    }
    if (googleNews.status === "fulfilled" && googleNews.value.length > 0) {
      allNews.push(...googleNews.value);
    }
    if (travelStateNews.status === "fulfilled" && travelStateNews.value.length > 0) {
      allNews.push(...travelStateNews.value);
    }

    // Remove duplicates based on URL
    const seenURLs = new Set<string>();
    allNews = allNews.filter((article) => {
      if (seenURLs.has(article.url)) {
        return false;
      }
      seenURLs.add(article.url);
      return true;
    });

    // Filter to only include recent articles (last 60 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);
    allNews = allNews.filter((article) => {
      const articleDate = this.parseArticleDate(article.date);
      if (articleDate) {
        return articleDate >= cutoffDate;
      }
      // If we can't parse the date, include it (might be today's news)
      return true;
    });

    // Sort by date (newest first) and prioritize breaking news
    allNews.sort((article1, article2) => {
      if (article1.priority === ArticlePriority.Breaking && article2.priority !== ArticlePriority.Breaking) {
        return -1;
      }
      if (article1.priority !== ArticlePriority.Breaking && article2.priority === ArticlePriority.Breaking) {
        return 1;
      }
      // Sort by actual date if available
      const date1 = this.parseArticleDate(article1.date) || new Date(0);
      const date2 = this.parseArticleDate(article2.date) || new Date(0);
      return date2.getTime() - date1.getTime();
    });

    // Limit to top 50 most recent articles
    allNews = allNews.slice(0, 50);

    // Cache the results (even if empty, to avoid repeated failed requests)
    this.saveCachedNews(allNews);
    this.setLastFetchDate(new Date());

    return allNews;
  }

  /**
   * Fetches news from USCIS RSS feed
   */
  private async fetchUSCISNews(): Promise<NewsArticle[]> {
    try {
      const url = "https://www.uscis.gov/news/rss.xml";
      const items = await this.fetchRSSFeed(url);

      return items
        .map((item) => {
          if (!item.title || !item.link || !item.pubDate) {
            return null;
          }

          // Determine priority based on keywords
          const priority = this.determinePriority(item.title, item.description || "");

          // Clean up description (remove HTML tags)
          const cleanDescription = this.cleanHTML(item.description || "");

          // Normalize URL
          const normalizedURL = this.normalizeURL(item.link, "https://www.uscis.gov");

          return {
            id: this.generateUUID(),
            title: item.title,
            summary: cleanDescription || "USCIS news update",
            url: normalizedURL,
            date: this.formatDate(item.pubDate),
            priority,
            readingTime: this.estimateReadingTime(cleanDescription),
            imageUrl: item.imageUrl || null,
          } as NewsArticle;
        })
        .filter((article): article is NewsArticle => article !== null);
    } catch (error) {
      console.error("Error fetching USCIS news:", error);
      return [];
    }
  }

  /**
   * Fetches news from DHS RSS feed
   */
  private async fetchDHSNews(): Promise<NewsArticle[]> {
    try {
      const url = "https://www.dhs.gov/news-releases/rss.xml";
      const items = await this.fetchRSSFeed(url);

      const relevantKeywords = [
        "uscis",
        "immigration",
        "visa",
        "green card",
        "citizenship",
        "naturalization",
        "refugee",
        "asylum",
        "border",
        "customs",
      ];

      return items
        .map((item) => {
          if (!item.title || !item.link || !item.pubDate) {
            return null;
          }

          const titleLower = item.title.toLowerCase();
          const descLower = (item.description || "").toLowerCase();
          const combined = titleLower + " " + descLower;

          // Only include if related to immigration, visas, or USCIS
          const isRelevant = relevantKeywords.some((keyword) => combined.includes(keyword));
          if (!isRelevant) {
            return null;
          }

          const priority = this.determinePriority(item.title, item.description || "");
          const cleanDescription = this.cleanHTML(item.description || "");
          const normalizedURL = this.normalizeURL(item.link, "https://www.dhs.gov");

          return {
            id: this.generateUUID(),
            title: item.title,
            summary: cleanDescription || "DHS immigration news update",
            url: normalizedURL,
            date: this.formatDate(item.pubDate),
            priority,
            readingTime: this.estimateReadingTime(cleanDescription),
            imageUrl: item.imageUrl || null,
          } as NewsArticle;
        })
        .filter((article): article is NewsArticle => article !== null);
    } catch (error) {
      console.error("Error fetching DHS news:", error);
      return [];
    }
  }

  /**
   * Fetches USCIS-related news from Google News RSS
   */
  private async fetchGoogleNews(): Promise<NewsArticle[]> {
    const queries = [
      "USCIS immigration news",
      "USCIS visa updates",
      "immigration policy changes",
      "green card news USCIS",
    ];

    const allArticles: NewsArticle[] = [];

    for (const query of queries) {
      try {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;
        const items = await this.fetchRSSFeed(url);

        const relevantKeywords = ["uscis", "immigration", "visa", "green card", "citizenship", "naturalization"];

        const articles = items
          .slice(0, 5) // Limit to 5 per query
          .map((item) => {
            if (!item.title || !item.link || !item.pubDate) {
              return null;
            }

            const titleLower = item.title.toLowerCase();
            const descLower = (item.description || "").toLowerCase();
            const combined = titleLower + " " + descLower;

            // Filter for USCIS/immigration relevance
            const isRelevant = relevantKeywords.some((keyword) => combined.includes(keyword));
            if (!isRelevant) {
              return null;
            }

            const priority = this.determinePriority(item.title, item.description || "");
            const cleanDescription = this.cleanHTML(item.description || "");
            const normalizedURL = this.normalizeURL(item.link, "https://news.google.com");

            return {
              id: this.generateUUID(),
              title: item.title,
              summary: cleanDescription || item.title,
              url: normalizedURL,
              date: this.formatDate(item.pubDate),
              priority,
              readingTime: this.estimateReadingTime(cleanDescription),
              imageUrl: item.imageUrl || null,
            } as NewsArticle;
          })
          .filter((article): article is NewsArticle => article !== null);

        allArticles.push(...articles);
      } catch (error) {
        console.error(`Error fetching Google News for query '${query}':`, error);
        continue;
      }
    }

    return allArticles;
  }

  /**
   * Fetches news from Travel.State.Gov (visa-related)
   */
  private async fetchTravelStateNews(): Promise<NewsArticle[]> {
    try {
      const url = "https://travel.state.gov/content/travel/en/News/rss.xml";
      const items = await this.fetchRSSFeed(url);

      return items
        .map((item) => {
          if (!item.title || !item.link || !item.pubDate) {
            return null;
          }

          const priority = this.determinePriority(item.title, item.description || "");
          const cleanDescription = this.cleanHTML(item.description || "");
          const normalizedURL = this.normalizeURL(item.link, "https://travel.state.gov");

          return {
            id: this.generateUUID(),
            title: item.title,
            summary: cleanDescription || "State Department visa news update",
            url: normalizedURL,
            date: this.formatDate(item.pubDate),
            priority,
            readingTime: this.estimateReadingTime(cleanDescription),
            imageUrl: item.imageUrl || null,
          } as NewsArticle;
        })
        .filter((article): article is NewsArticle => article !== null);
    } catch (error) {
      console.error("Error fetching Travel.State.Gov news:", error);
      return [];
    }
  }

  /**
   * Fetches and parses RSS feed
   * Uses API proxy to avoid CORS issues
   */
  private async fetchRSSFeed(url: string): Promise<RSSItem[]> {
    try {
      // Use API proxy to avoid CORS issues
      const proxyUrl = `/api/news/proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        console.error(`RSS feed returned status code: ${response.status}`);
        // Fallback: try direct fetch (might work in some cases)
        try {
          const directResponse = await fetch(url);
          if (directResponse.ok) {
            const xmlText = await directResponse.text();
            return this.parseRSS(xmlText);
          }
        } catch (fallbackError) {
          console.error("Direct fetch also failed:", fallbackError);
        }
        return [];
      }

      const xmlText = await response.text();
      return this.parseRSS(xmlText);
    } catch (error) {
      console.error(`Error fetching RSS feed from ${url}:`, error);
      return [];
    }
  }

  /**
   * Parses RSS XML text into RSSItem array
   */
  private parseRSS(xmlText: string): RSSItem[] {
    const items: RSSItem[] = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("RSS parsing error:", parserError.textContent);
      return [];
    }

    const itemElements = xmlDoc.querySelectorAll("item");

    itemElements.forEach((itemElement) => {
      const title = itemElement.querySelector("title")?.textContent?.trim() || null;
      const link = itemElement.querySelector("link")?.textContent?.trim() || null;
      const description = itemElement.querySelector("description")?.textContent?.trim() || null;
      const pubDateText = itemElement.querySelector("pubDate")?.textContent?.trim() || null;

      let pubDate: Date | null = null;
      if (pubDateText) {
        pubDate = this.parseRSSDate(pubDateText);
      }

      // Extract image from enclosure, media:content, media:thumbnail, or first img in description
      let imageUrl: string | null = null;
      const enclosure = itemElement.querySelector("enclosure");
      if (enclosure?.getAttribute("type")?.startsWith("image/")) {
        imageUrl = enclosure.getAttribute("url") || null;
      }
      if (!imageUrl) {
        const allEls = itemElement.querySelectorAll("[url]");
        for (const el of allEls) {
          const tag = (el.tagName || el.localName || "").toLowerCase();
          const url = el.getAttribute("url") || "";
          if ((tag.includes("content") || tag.includes("thumbnail")) && url) {
            imageUrl = url;
            break;
          }
        }
      }
      if (!imageUrl && description) {
        const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) imageUrl = imgMatch[1];
      }

      if (title && link && pubDate) {
        items.push({
          title,
          link,
          description,
          pubDate,
          imageUrl: imageUrl || undefined,
        });
      }
    });

    return items;
  }

  /**
   * Parses RSS pubDate string to Date
   */
  private parseRSSDate(dateString: string): Date | null {
    // RSS date format: "EEE, dd MMM yyyy HH:mm:ss Z" (e.g., "Mon, 15 Jan 2025 10:30:00 -0500")
    const formats = [
      "EEE, dd MMM yyyy HH:mm:ss Z",
      "EEE, dd MMM yyyy HH:mm:ss z",
      "dd MMM yyyy HH:mm:ss Z",
      "dd MMM yyyy HH:mm:ss z",
    ];

    for (const format of formats) {
      // Try parsing with different approaches
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  /**
   * Determines article priority based on keywords
   */
  private determinePriority(title: string, description: string): ArticlePriority {
    const combined = (title + " " + description).toLowerCase();

    if (combined.includes("breaking") || combined.includes("emergency") || combined.includes("urgent")) {
      return ArticlePriority.Breaking;
    } else if (
      combined.includes("important") ||
      combined.includes("update") ||
      combined.includes("change") ||
      combined.includes("announcement")
    ) {
      return ArticlePriority.Urgent;
    }

    return ArticlePriority.Normal;
  }

  /**
   * Parses article date string to Date object
   */
  private parseArticleDate(dateString: string): Date | null {
    // Handle special cases
    if (dateString === "Today") {
      return new Date();
    }
    if (dateString === "Yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }

    // Try parsing as day name (e.g., "Monday")
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    if (dayNames.includes(dateString)) {
      // Find the most recent occurrence of this day
      const today = new Date();
      const todayDay = today.getDay();
      const targetDay = dayNames.indexOf(dateString);
      let daysAgo = (todayDay - targetDay + 7) % 7;
      if (daysAgo === 0) daysAgo = 7; // If today, use last week
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date;
    }

    // Try standard date formats
    const formats = [
      "MMMM d, yyyy",
      "MMM d, yyyy",
      "yyyy-MM-dd",
      "MM/dd/yyyy",
      "dd/MM/yyyy",
    ];

    for (const format of formats) {
      // Use date-fns or manual parsing
      const date = this.parseDateWithFormat(dateString, format);
      if (date) {
        return date;
      }
    }

    return null;
  }

  /**
   * Parses date string with specific format
   */
  private parseDateWithFormat(dateString: string, format: string): Date | null {
    // Simple date parsing (can be enhanced with date-fns)
    try {
      // For "MMMM d, yyyy" format
      if (format === "MMMM d, yyyy" || format === "MMM d, yyyy") {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // For "yyyy-MM-dd" format
      if (format === "yyyy-MM-dd") {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // For "MM/dd/yyyy" format
      if (format === "MM/dd/yyyy") {
        const parts = dateString.split("/");
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10) - 1;
          const day = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return null;
  }

  /**
   * Formats date to display string (matching iOS formatDate)
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const articleDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // If the date is today, show "Today"
    if (articleDate.getTime() === today.getTime()) {
      return "Today";
    }

    // If the date is yesterday, show "Yesterday"
    if (articleDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    }

    // For dates within the last week, show day name
    const daysAgo = Math.floor((today.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAgo < 7) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return dayNames[date.getDay()];
    }

    // For older dates, show full date
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  /**
   * Estimates reading time in minutes
   */
  private estimateReadingTime(text: string): number {
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.floor(words / 200)); // Assume 200 words per minute
  }

  /**
   * Removes HTML tags from a string
   */
  private cleanHTML(html: string): string {
    // Create a temporary div element
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    let text = tmp.textContent || tmp.innerText || "";

    // Clean up common HTML entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    return text;
  }

  /**
   * Normalizes URLs to ensure they are valid and absolute
   */
  private normalizeURL(urlString: string, baseURL: string): string {
    let url = urlString.trim();

    if (!url) {
      return baseURL;
    }

    // Handle Google News redirect URLs
    if (url.includes("news.google.com/rss/articles/") || url.includes("url?q=")) {
      const urlParamMatch = url.match(/url\?q=([^&]+)/);
      if (urlParamMatch) {
        url = decodeURIComponent(urlParamMatch[1]);
      }
    }

    // If it's already a valid absolute URL, return it
    if (url.startsWith("http://") || url.startsWith("https://")) {
      try {
        new URL(url);
        return url;
      } catch {
        // Invalid URL, continue to fix it
      }
    }

    // Handle relative URLs
    if (url.startsWith("/")) {
      return baseURL + url;
    }

    // If it doesn't start with http, try to make it absolute
    if (!url.startsWith("http")) {
      if (url.includes(".") && !url.includes(" ")) {
        return "https://" + url;
      } else {
        return baseURL + "/" + url;
      }
    }

    // Final validation
    try {
      new URL(url);
      return url;
    } catch {
      return baseURL;
    }
  }

  // MARK: - Caching

  private saveCachedNews(news: NewsArticle[]): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CACHED_NEWS_KEY, JSON.stringify(news));
      }
    } catch (error) {
      console.error("Error saving cached news:", error);
    }
  }

  private loadCachedNews(): NewsArticle[] | null {
    try {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem(CACHED_NEWS_KEY);
        if (cached) {
          return JSON.parse(cached) as NewsArticle[];
        }
      }
    } catch (error) {
      console.error("Error loading cached news:", error);
    }
    return null;
  }

  private setLastFetchDate(date: Date): void {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_FETCH_DATE_KEY, date.toISOString());
      }
    } catch (error) {
      console.error("Error setting last fetch date:", error);
    }
  }

  private getLastFetchDate(): Date | null {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(LAST_FETCH_DATE_KEY);
        if (stored) {
          return new Date(stored);
        }
      }
    } catch (error) {
      console.error("Error getting last fetch date:", error);
    }
    return null;
  }

  // MARK: - Helpers

  private isDateInToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  private getHoursSince(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const newsService = NewsService.getInstance();
