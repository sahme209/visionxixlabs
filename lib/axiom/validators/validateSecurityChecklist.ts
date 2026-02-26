/**
 * Phase 5: Ensure security checklist has minimum sections.
 */
export function validateSecurityChecklist(content: string | null | undefined): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!content || typeof content !== "string") {
    return { valid: false, issues: ["Empty checklist content"] };
  }
  const s = content.toLowerCase();
  const minTerms = ["iam", "mfa", "audit", "exposure"];
  for (const term of minTerms) {
    if (!s.includes(term)) {
      issues.push(`Checklist should cover: ${term}`);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}
