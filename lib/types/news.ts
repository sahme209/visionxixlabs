// News Article Types - Matching iOS NewsArticle structure exactly

export enum ArticlePriority {
  Breaking = "breaking",
  Urgent = "urgent",
  Normal = "normal",
}

export interface NewsArticle {
  id: string; // UUID equivalent
  title: string;
  summary: string;
  url: string;
  date: string; // Formatted date string
  priority: ArticlePriority;
  readingTime: number; // Minutes
  imageUrl?: string | null; // From RSS enclosure or media
}

// RSS Item structure for parsing
export interface RSSItem {
  title: string | null;
  link: string | null;
  description: string | null;
  pubDate: Date | null;
  imageUrl?: string | null;
}
