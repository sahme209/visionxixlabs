/**
 * Maps user intent phrases to execution plugins.
 * Used to auto-suggest tool calls when the LLM returns none.
 */

export const READ_ONLY_PLUGINS = new Set([
  "aws:infra-discovery",
  "aws:iam-exposure-scan",
  "aws:cost-explorer-summary",
  "aws:s3-public-bucket-scan",
]);

export const DESTRUCTIVE_PLUGINS = new Set(["aws:disable-unused-access-key"]);

export type IntentMatch = {
  pluginId: string;
  readOnly: boolean;
  confidence: "high" | "medium";
};

/** Patterns (lowercase) that map to plugins. First match wins. */
const INTENT_PATTERNS: Array<{
  pluginId: string;
  patterns: RegExp[];
  readOnly: boolean;
}> = [
  {
    pluginId: "aws:infra-discovery",
    patterns: [
      /analyze\s+my\s+(aws\s+)?environment/i,
      /\bscan\s+my\s+(aws\s+)?environment\b/i,
      /\bcheck\s+my\s+(aws\s+)?environment\b/i,
      /\bdiscover\s+(my\s+)?infrastructure\b/i,
      /\bwhat\s+infrastructure\s+do\s+i\s+have\b/i,
      /\bshow\s+me\s+my\s+(aws\s+)?infrastructure\b/i,
      /scan\s+(my\s+)?(environment|infra)/i,
      /discover\s+(my\s+)?(infra|infrastructure|resources)/i,
      /show\s+(me\s+)?(what\s+)?(infrastructure|infra|resources)\s+(i\s+)?have/i,
      /what\s+(do\s+i\s+have|infrastructure|resources)/i,
      /list\s+(my\s+)?(infra|infrastructure|resources)/i,
      /inventory\s+(my\s+)?(aws|infra)/i,
      /analyze\s+my\s+(aws\s+)?(infrastructure|infra)/i,
    ],
    readOnly: true,
  },
  {
    pluginId: "aws:iam-exposure-scan",
    patterns: [
      /check\s+(my\s+)?(iam|security)/i,
      /analyze\s+my\s+(aws\s+)?security\s+posture/i,
      /scan\s+(my\s+)?(environment|aws)\s+for\s+issues/i,
      /scan\s+(my\s+)?(iam|security)/i,
      /iam\s+(security|exposure|audit|scan)/i,
      /security\s+(scan|audit|check|posture)/i,
      /exposure\s+scan/i,
      /audit\s+(my\s+)?(iam|security)/i,
    ],
    readOnly: true,
  },
  {
    pluginId: "github:create-cicd-pipeline",
    patterns: [
      /create\s+(a\s+)?ci\/?cd/i,
      /set\s+up\s+github\s+actions/i,
      /add\s+ci\b/i,
      /build\s+pipeline/i,
      /\bgithub\s+actions\b/i,
    ],
    readOnly: false,
  },
  {
    pluginId: "aws:s3-public-bucket-scan",
    patterns: [
      /check\s+(if\s+)?my\s+s3\s+buckets\s+are\s+public/i,
      /\bpublic\s+s3\b/i,
      /s3\s+security/i,
      /s3\s+buckets\s+public/i,
      /scan\s+s3/i,
      /find\s+(public\s+)?s3\s+buckets/i,
    ],
    readOnly: true,
  },
  {
    pluginId: "aws:cost-explorer-summary",
    patterns: [
      /analyze\s+(my\s+)?aws\s+costs/i,
      /\baws\s+spend\b/i,
      /\baws\s+billing\b/i,
    ],
    readOnly: true,
  },
  {
    pluginId: "aws:disable-unused-access-key",
    patterns: [
      /disable\s+unused\s+(access\s+)?keys/i,
      /cleanup\s+(unused\s+)?(access\s+)?keys/i,
      /remove\s+unused\s+(access\s+)?keys/i,
      /deactivate\s+unused\s+(access\s+)?keys/i,
      /fix\s+unused\s+(access\s+)?keys/i,
      /rotate\s+.*(unused|stale)\s+keys/i,
    ],
    readOnly: false,
  },
];

/**
 * Detect intent from user message. Returns suggested plugin(s) when confidence is high.
 * Only suggests read-only plugins for auto-run; destructive plugins require plan approval.
 */
export function mapIntentToPlugin(message: string): IntentMatch | null {
  const normalized = message.trim();
  if (!normalized || normalized.length < 5) return null;

  for (const { pluginId, patterns, readOnly } of INTENT_PATTERNS) {
    for (const re of patterns) {
      if (re.test(normalized)) {
        return {
          pluginId,
          readOnly,
          confidence: readOnly ? "high" : "medium",
        };
      }
    }
  }
  return null;
}

/**
 * Multi-step intent: "secure my AWS" → suggest full plan order.
 */
export function getMultiStepIntent(message: string): string[] | null {
  const m = message.toLowerCase();
  if (
    /\bsecure\s+my\s+(aws|environment)\b/.test(m) ||
    /\baudit\s+and\s+fix\s+iam\b/.test(m) ||
    /\bfull\s+(security|compliance)\s+(check|audit)\b/.test(m) ||
    /\bhardening\s+(my\s+)?aws\b/.test(m)
  ) {
    return ["aws:infra-discovery", "aws:iam-exposure-scan", "aws:disable-unused-access-key"];
  }
  if (/\bdiscover\s+.*(then|and)\s+.*(iam|scan)\b/.test(m)) {
    return ["aws:infra-discovery", "aws:iam-exposure-scan"];
  }
  return null;
}
