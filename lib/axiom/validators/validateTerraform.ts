/**
 * Phase 5: Basic Terraform pattern checks.
 * No execution.
 */
export function validateTerraform(content: string | null | undefined): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!content || typeof content !== "string") {
    return { valid: false, issues: ["Empty or invalid Terraform content"] };
  }
  const s = content.trim();
  if (!s.includes("terraform") && !s.includes("resource") && !s.includes("provider")) {
    issues.push("Missing common Terraform blocks (terraform, resource, provider)");
  }
  if (s.includes("${") && !s.includes("}")) {
    issues.push("Possible unclosed interpolation");
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}
