/**
 * Phase 5: Basic GitHub Actions YAML validation.
 * Checks required keys; no execution.
 */
export function validateGithubActionsYaml(yaml: string | null | undefined): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!yaml || typeof yaml !== "string") {
    return { valid: false, issues: ["Empty or invalid YAML content"] };
  }
  const s = yaml.trim();
  if (!s.includes("on:") && !s.includes("jobs:")) {
    issues.push("Missing required 'on:' or 'jobs:' keys");
  }
  if (s.includes("{{") || s.includes("}}")) {
    issues.push("Possible unsubstituted template placeholders");
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}
