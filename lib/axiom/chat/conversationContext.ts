/**
 * Conversation Context — entity extraction and multi-turn state resolution
 *
 * Extracts grounded entities (provider, time range, item references, categories)
 * from user messages and merges them with prior conversation state so handlers
 * can filter results without the user repeating themselves every turn.
 *
 * No LLM calls — pure regex + heuristic extraction.
 */

import type { CloudProvider } from "../cloudSnapshot";

// ---------------------------------------------------------------------------
// 1. Extracted entities — what we pull from a single message
// ---------------------------------------------------------------------------

export type ExtractedEntities = {
  provider: CloudProvider | null;
  timeRange: TimeRange | null;
  itemRef: string | null;
  category: string | null;
};

export type TimeRange = {
  since: Date;
  label: string;
};

// ---------------------------------------------------------------------------
// 2. Conversation state — carried forward across turns
// ---------------------------------------------------------------------------

export type ConversationState = {
  lastProvider: CloudProvider | null;
  lastRunId: string | null;
  lastFindingRef: string | null;
  lastItemRef: string | null;
  lastIntent: string | null;
  turnCount: number;
};

export function emptyConversationState(): ConversationState {
  return {
    lastProvider: null,
    lastRunId: null,
    lastFindingRef: null,
    lastItemRef: null,
    lastIntent: null,
    turnCount: 0,
  };
}

// ---------------------------------------------------------------------------
// 3. Resolved context — merged entities + state for handlers
// ---------------------------------------------------------------------------

export type ResolvedContext = {
  provider: CloudProvider | null;
  timeRange: TimeRange | null;
  itemRef: string | null;
  category: string | null;
};

// ---------------------------------------------------------------------------
// 4. Entity extraction — runs on every user message
// ---------------------------------------------------------------------------

export function extractEntities(text: string): ExtractedEntities {
  return {
    provider: extractProvider(text),
    timeRange: extractTimeRange(text),
    itemRef: extractItemRef(text),
    category: extractCategory(text),
  };
}

// --- Provider ---

const PROVIDER_PATTERNS: Array<{ pattern: RegExp; provider: CloudProvider }> = [
  { pattern: /\b(aws|amazon\s*web\s*services?)\b/i, provider: "aws" },
  { pattern: /\b(azure|microsoft\s*azure)\b/i, provider: "azure" },
  { pattern: /\b(gcp|google\s*cloud|gce)\b/i, provider: "gcp" },
];

function extractProvider(text: string): CloudProvider | null {
  for (const { pattern, provider } of PROVIDER_PATTERNS) {
    if (pattern.test(text)) return provider;
  }
  return null;
}

// --- Time range ---

function extractTimeRange(text: string): TimeRange | null {
  const now = new Date();

  if (/\btoday\b/i.test(text)) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { since: start, label: "today" };
  }

  if (/\byesterday\b/i.test(text)) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    return { since: start, label: "since yesterday" };
  }

  if (/\bthis\s*week\b/i.test(text)) {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return { since: start, label: "this week" };
  }

  if (/\blast\s*week\b/i.test(text)) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { since: start, label: "in the last 7 days" };
  }

  const daysMatch = text.match(/\blast\s*(\d+)\s*days?\b/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    return { since: start, label: `in the last ${days} days` };
  }

  const hoursMatch = text.match(/\blast\s*(\d+)\s*hours?\b/i);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    const start = new Date(now);
    start.setHours(start.getHours() - hours);
    return { since: start, label: `in the last ${hours} hours` };
  }

  if (/\bthis\s*month\b/i.test(text)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { since: start, label: "this month" };
  }

  return null;
}

// --- Item reference ---

function extractItemRef(text: string): string | null {
  const match = text.match(/\b(plan-\d+|rec-\d+|item-\d+|finding-\d+|i-[a-z0-9]+)\b/i);
  return match ? match[1] : null;
}

// --- Category ---

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(cost|spend|saving|price|waste|expensive|cheap)\b/i, category: "cost" },
  { pattern: /\b(resilien|availab|redundan|failover|uptime|region)\b/i, category: "resilience" },
  { pattern: /\b(secur|public|expos|vulnerab|access|permiss)\b/i, category: "security" },
  { pattern: /\b(perform|latenc|throughput|speed|slow)\b/i, category: "performance" },
  { pattern: /\b(complian|audit|regulat|governance)\b/i, category: "compliance" },
];

function extractCategory(text: string): string | null {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5. Context resolution — merges current entities with conversation history
// ---------------------------------------------------------------------------

export function resolveContext(
  entities: ExtractedEntities,
  state: ConversationState | null,
): ResolvedContext {
  return {
    provider: entities.provider ?? state?.lastProvider ?? null,
    timeRange: entities.timeRange,
    itemRef: entities.itemRef ?? state?.lastItemRef ?? null,
    category: entities.category,
  };
}

export function advanceState(
  state: ConversationState,
  intent: string,
  entities: ExtractedEntities,
  runId?: string,
): ConversationState {
  return {
    lastProvider: entities.provider ?? state.lastProvider,
    lastRunId: runId ?? state.lastRunId,
    lastFindingRef: entities.itemRef?.startsWith("finding-") ? entities.itemRef : state.lastFindingRef,
    lastItemRef: entities.itemRef ?? state.lastItemRef,
    lastIntent: intent,
    turnCount: state.turnCount + 1,
  };
}

// ---------------------------------------------------------------------------
// 6. Invariant tests
// ---------------------------------------------------------------------------

export type ContextTestResult = { name: string; passed: boolean; detail: string };

export function runContextTests(): ContextTestResult[] {
  const results: ContextTestResult[] = [];

  // Test 1: Provider extraction
  {
    const aws = extractEntities("Show me AWS findings");
    const azure = extractEntities("Generate Terraform for Azure");
    const gcp = extractEntities("Summarize Google Cloud");
    const none = extractEntities("What should I fix first?");

    results.push({
      name: "Provider extraction from natural language",
      passed: aws.provider === "aws" && azure.provider === "azure" && gcp.provider === "gcp" && none.provider === null,
      detail: `aws=${aws.provider}, azure=${azure.provider}, gcp=${gcp.provider}, none=${none.provider}`,
    });
  }

  // Test 2: Time range extraction
  {
    const week = extractEntities("What changed this week?");
    const days = extractEntities("Show changes from last 30 days");
    const today = extractEntities("Any alerts today?");
    const none = extractEntities("Show my findings");

    results.push({
      name: "Time range extraction",
      passed: week.timeRange?.label === "this week" && days.timeRange?.label === "in the last 30 days" && today.timeRange?.label === "today" && none.timeRange === null,
      detail: `week=${week.timeRange?.label}, days=${days.timeRange?.label}, today=${today.timeRange?.label}, none=${none.timeRange}`,
    });
  }

  // Test 3: Category extraction
  {
    const cost = extractEntities("Show me cost savings");
    const security = extractEntities("Any security issues?");
    const resilience = extractEntities("Check availability concerns");
    const none = extractEntities("What should I fix first?");

    results.push({
      name: "Category extraction",
      passed: cost.category === "cost" && security.category === "security" && resilience.category === "resilience" && none.category === null,
      detail: `cost=${cost.category}, sec=${security.category}, res=${resilience.category}, none=${none.category}`,
    });
  }

  // Test 4: Item reference extraction
  {
    const finding = extractEntities("Tell me about finding-42");
    const item = extractEntities("Why is item-7 risky?");
    const instance = extractEntities("Explain i-0abc123def");
    const none = extractEntities("Show findings");

    results.push({
      name: "Item reference extraction",
      passed: finding.itemRef === "finding-42" && item.itemRef === "item-7" && instance.itemRef === "i-0abc123def" && none.itemRef === null,
      detail: `finding=${finding.itemRef}, item=${item.itemRef}, instance=${instance.itemRef}, none=${none.itemRef}`,
    });
  }

  // Test 5: Context resolution with state carry-forward
  {
    const state: ConversationState = {
      lastProvider: "aws",
      lastRunId: "run-1",
      lastFindingRef: "finding-5",
      lastItemRef: "item-3",
      lastIntent: "what_found",
      turnCount: 3,
    };

    const entitiesNoProvider = extractEntities("What should I fix first?");
    const resolved = resolveContext(entitiesNoProvider, state);

    results.push({
      name: "Context resolution inherits provider from prior turn",
      passed: resolved.provider === "aws",
      detail: `Resolved provider: ${resolved.provider} (should inherit aws from state)`,
    });

    const entitiesWithProvider = extractEntities("Show me Azure findings");
    const resolved2 = resolveContext(entitiesWithProvider, state);

    results.push({
      name: "Explicit provider overrides inherited state",
      passed: resolved2.provider === "azure",
      detail: `Resolved provider: ${resolved2.provider} (should be azure, not inherited aws)`,
    });
  }

  // Test 6: State advancement
  {
    const state = emptyConversationState();
    const entities = extractEntities("Scan my AWS account");
    const next = advanceState(state, "start_scan", entities, "run-123");

    results.push({
      name: "State advancement captures provider and run ID",
      passed: next.lastProvider === "aws" && next.lastRunId === "run-123" && next.turnCount === 1,
      detail: `provider=${next.lastProvider}, runId=${next.lastRunId}, turns=${next.turnCount}`,
    });
  }

  // Test 7: Multiple entities in one message
  {
    const entities = extractEntities("Show me AWS cost savings from last 7 days");

    results.push({
      name: "Multiple entities extracted from single message",
      passed: entities.provider === "aws" && entities.category === "cost" && entities.timeRange?.label === "in the last 7 days",
      detail: `provider=${entities.provider}, category=${entities.category}, time=${entities.timeRange?.label}`,
    });
  }

  return results;
}
