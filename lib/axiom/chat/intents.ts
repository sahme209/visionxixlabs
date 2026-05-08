import type { ChatIntent } from "./types";

// ---------------------------------------------------------------------------
// Intent classification — keyword/pattern matching, no LLM call needed
//
// Each rule is: [patterns to match, intent, optional entity extractor].
// First match wins. Order matters — more specific patterns go first.
// ---------------------------------------------------------------------------

type IntentRule = {
  patterns: RegExp[];
  intent: ChatIntent;
  extractParams?: (text: string) => Record<string, string>;
};

const RULES: IntentRule[] = [
  {
    patterns: [
      /\b(scan|rescan|re-scan|analyze|check)\s*(my|the|this)?\s*(account|infra|cloud|environment)/i,
      /\brun\s*(a|another|new)?\s*scan/i,
      /\bstart\s*(a|another|new)?\s*(scan|analysis)/i,
    ],
    intent: "start_scan",
  },
  {
    patterns: [
      /\b(apply|fix|execute)\s*(the\s*)?(safe|auto|low.risk)\s*(fixes|actions|changes)/i,
      /\bapply\s*(everything|all)\s*(that'?s?)?\s*safe/i,
      /\bauto.?fix/i,
    ],
    intent: "apply_safe",
  },
  {
    patterns: [
      /\b(approve|accept)\s*(all|these|the)\s*(fix|action|change|recommendation)/i,
      /\bapprove/i,
      /\breject\s*(all|these|the)/i,
    ],
    intent: "approval_decision",
    extractParams: (text) => {
      if (/reject/i.test(text)) return { decision: "reject_all" };
      if (/partial/i.test(text)) return { decision: "approve_partial" };
      return { decision: "approve_all" };
    },
  },
  {
    patterns: [
      /\bshow\s*(me\s*)?(the\s*)?terraform/i,
      /\bgenerate\s*(the\s*)?terraform/i,
      /\b(export|download)\s*(the\s*)?terraform/i,
      /\b(iac|infrastructure.as.code)/i,
    ],
    intent: "show_terraform",
  },
  {
    patterns: [
      /\bshow\s*(me\s*)?(the\s*)?(cli|commands?|script)/i,
      /\bgenerate\s*(the\s*)?(cli|commands?|script)/i,
    ],
    intent: "show_cli",
  },
  {
    patterns: [
      /\bwhy\s*(is\s*)?(this|that|it)\s*(risky|dangerous|unsafe)/i,
      /\bwhat('?s| is| are)\s*(the\s*)?risk/i,
      /\bexplain\s*(the\s*)?risk/i,
      /\bhow\s*(safe|risky|dangerous)/i,
    ],
    intent: "why_risky",
    extractParams: (text) => {
      const m = text.match(/\b(plan-\d+|rec-\d+|item-\d+)\b/i);
      return m ? { itemRef: m[1] } : ({} as Record<string, string>);
    },
  },
  {
    patterns: [
      /\bwhat\s*(has\s*)?(changed|different|new)\s*(since|from|between)/i,
      /\bchanges?\s*since\s*(last|previous)/i,
      /\bdiff\b/i,
      /\bcompare\s*(to|with)\s*(last|previous)/i,
    ],
    intent: "changes_since",
  },
  {
    patterns: [
      /\bhow\s*much\s*(can|could|would)\s*(i|we)\s*save/i,
      /\b(total|estimated|potential)\s*savings/i,
      /\bsavings\s*(summary|breakdown|estimate|overview)/i,
      /\bhow\s*much\s*(am|are)\s*(i|we)\s*(spending|wasting)/i,
    ],
    intent: "savings_summary",
  },
  {
    patterns: [
      /\bwhat\s*(should|do)\s*(i|we)\s*(fix|do|address|tackle)\s*first/i,
      /\bprioritize/i,
      /\btop\s*(priority|priorities|items|recommendations)/i,
      /\bmost\s*(important|urgent|critical)/i,
      /\bwhere\s*(should|do)\s*(i|we)\s*start/i,
    ],
    intent: "fix_priority",
  },
  {
    patterns: [
      /\bwhat\s*(did\s*)?(you|the\s*agent)\s*(find|discover|detect)/i,
      /\bshow\s*(me\s*)?(the\s*)?(findings|results|issues|problems)/i,
      /\bwhat('?s| is| are)\s*(wrong|the\s*issue|the\s*problem)/i,
      /\bgive\s*me\s*(a\s*)?(summary|overview|recap)/i,
      /\bsummarize/i,
    ],
    intent: "what_found",
  },
  {
    patterns: [
      /\btell\s*me\s*(more\s*)?(about|regarding)/i,
      /\bexplain\s*(this|that|the)\s*(finding|issue|recommendation)/i,
      /\bwhat\s*does\s*(this|that)\s*mean/i,
      /\bdetail/i,
    ],
    intent: "explain_finding",
    extractParams: (text) => {
      const m = text.match(/\b(finding-\d+|rec-\d+)\b/i);
      return m ? { ref: m[1] } : ({} as Record<string, string>);
    },
  },
  {
    patterns: [
      /\b(what'?s|what\s*is)\s*(the\s*)?(status|state|progress)/i,
      /\bis\s*(the\s*)?(scan|run|agent)\s*(done|complete|finished|running)/i,
      /\bhow('?s| is)\s*(the\s*)?(scan|run)/i,
    ],
    intent: "run_status",
  },
  {
    patterns: [
      /\b(list|show|which)\s*(my\s*)?(cloud\s*)?(accounts?|connections?)/i,
      /\bconnected\s*(accounts?|clouds?)/i,
    ],
    intent: "list_accounts",
  },
];

// ---------------------------------------------------------------------------
// Classify — returns intent + extracted params
// ---------------------------------------------------------------------------

export function classifyIntent(
  text: string,
): { intent: ChatIntent; params: Record<string, string> } {
  const normalized = text.trim();

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        const params = rule.extractParams?.(normalized) ?? {};
        return { intent: rule.intent, params };
      }
    }
  }

  return { intent: "unknown", params: {} };
}
