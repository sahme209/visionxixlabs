/**
 * Site-wide search index for global search
 * Used by /search page to find pages and content across the website
 */

import { guides } from "./guides-data";

export interface SearchResult {
  title: string;
  path: string;
  description: string;
  category: "page" | "help" | "guide" | "tool" | "resource";
}

/** Flattened search index - title, path, description, and keywords to match */
const PAGE_INDEX: Omit<SearchResult, "category">[] = [
  { title: "Home", path: "/", description: "Dashboard, case overview, timeline, key dates" },
  { title: "Statistics Pro", path: "/stats", description: "USCIS processing stats, I-130 I-129F approvals, trends" },
  { title: "Resources", path: "/resources", description: "Processing times, fees, status decoder, official links" },
  { title: "Guides", path: "/guides", description: "Form filing guides I-130 I-129F I-485 I-765 I-131" },
  { title: "News", path: "/news", description: "Immigration news and updates" },
  { title: "Help Center", path: "/help", description: "FAQs, documents, timelines, interview prep" },
  { title: "Processing Times", path: "/processing-times", description: "Current USCIS processing dates by form and service center" },
  { title: "Fee Calculator", path: "/fees", description: "Estimate filing fees for immigration forms" },
  { title: "Status Decoder", path: "/status-decoder", description: "Understand case status in plain language" },
  { title: "Official Links", path: "/official-links", description: "CEAC, visa bulletin, NVC, USCIS official links" },
  { title: "Embassy Finder", path: "/embassy", description: "U.S. embassies and consulates" },
  { title: "Travel Advisories", path: "/travel-advisories", description: "Country travel safety information" },
  { title: "Visa Pause Impact", path: "/visa-pause-impact", description: "CLINIC v. Rubio visa pause recovery tracking" },
  { title: "Subscribe", path: "/subscribe", description: "Premium subscription and free trial" },
  { title: "Login", path: "/login", description: "Sign in to your account" },
  { title: "Profile Setup", path: "/profile-setup", description: "Add priority date and case details" },
  { title: "Settings", path: "/settings", description: "Account settings" },
  { title: "About", path: "/about", description: "About VisaNova" },
  { title: "Privacy", path: "/privacy", description: "Privacy policy" },
  { title: "Terms", path: "/terms", description: "Terms of service" },
  // Help topics
  { title: "FAQs", path: "/help/faq", description: "Common questions and community scenarios" },
  { title: "Documents & Sponsors", path: "/help/documents", description: "Required documents, I-864, sponsor requirements" },
  { title: "Country Guidance", path: "/help/country", description: "Country-specific visa requirements" },
  { title: "Process Timelines", path: "/help/timelines", description: "Step-by-step immigration timelines" },
  { title: "Interview Prep", path: "/help/interview-prep", description: "Prepare for immigration interviews" },
  { title: "Mock Interview", path: "/help/mock-interview", description: "Practice interview simulation" },
  { title: "Question Review", path: "/help/question-review", description: "Common interview questions" },
  { title: "Example Forms", path: "/help/example-forms", description: "Sample completed immigration forms" },
  { title: "Track Case", path: "/help/track-case", description: "How to track your case status" },
  { title: "Timeline Scenarios", path: "/help/scenarios", description: "Processing speed and approval timeline" },
  { title: "Stuck Cases", path: "/help/stuck", description: "What to do if your case is stuck" },
  // Tools
  { title: "Case Tools", path: "/tools/case-tools", description: "Case management and tracking tools" },
  { title: "Queue Position", path: "/tools/queue-position", description: "Estimate your position in the queue" },
  { title: "Expedite Request", path: "/tools/expedite", description: "Request expedited processing" },
  { title: "Action Plan", path: "/tools/action-plan", description: "Personalized next steps" },
  { title: "Timeline Alerts", path: "/tools/timeline-alerts", description: "Get notified about your timeline" },
  { title: "Document Pack", path: "/tools/document-pack", description: "Document checklist" },
  { title: "Evidence Checklist", path: "/tools/evidence-checklist", description: "Evidence gathering checklist" },
  { title: "RFE Response", path: "/tools/rfe-response", description: "Request for Evidence response" },
];

function buildSearchText(item: { title: string; path: string; description: string }): string {
  return `${item.title} ${item.path} ${item.description}`.toLowerCase();
}

export function searchSite(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Helper to add result
  const add = (title: string, path: string, description: string, category: SearchResult["category"]) => {
    if (seen.has(path)) return;
    seen.add(path);
    results.push({ title, path, description, category });
  };

  // Search pages
  for (const item of PAGE_INDEX) {
    const text = buildSearchText(item);
    if (text.includes(q) || q.split(/\s+/).every((word) => text.includes(word))) {
      const cat: SearchResult["category"] =
        item.path.startsWith("/help") ? "help" :
        item.path.startsWith("/tools") ? "tool" :
        ["/resources", "/official-links", "/embassy", "/travel-advisories", "/processing-times", "/fees", "/status-decoder"].includes(item.path) ? "resource" :
        "page";
      add(item.title, item.path, item.description, cat);
    }
  }

  // Search guides
  for (const guide of guides) {
    const text = `${guide.title} ${guide.overview} ${guide.id}`.toLowerCase();
    if (text.includes(q) || q.split(/\s+/).some((word) => text.includes(word))) {
      const path = `/guides/${guide.id}`;
      if (!seen.has(path)) {
        seen.add(path);
        results.push({
          title: guide.title.replace(/^[^\w\s]+/, "").trim(),
          path,
          description: guide.overview ?? "",
          category: "guide",
        });
      }
    }
  }

  // Sort: exact title match first, then by category
  const categoryOrder = { page: 0, resource: 1, tool: 2, help: 3, guide: 4 };
  results.sort((a, b) => {
    const aExact = a.title.toLowerCase().includes(q) ? 0 : 1;
    const bExact = b.title.toLowerCase().includes(q) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return categoryOrder[a.category] - categoryOrder[b.category];
  });

  return results.slice(0, 30);
}
