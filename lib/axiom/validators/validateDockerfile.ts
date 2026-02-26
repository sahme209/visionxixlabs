/**
 * Phase 5: Basic Dockerfile instruction checks.
 */
export function validateDockerfile(content: string | null | undefined): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!content || typeof content !== "string") {
    return { valid: false, issues: ["Empty or invalid Dockerfile content"] };
  }
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const validInstructions = ["FROM", "RUN", "COPY", "ADD", "WORKDIR", "ENV", "EXPOSE", "CMD", "ENTRYPOINT"];
  let hasFrom = false;
  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper.startsWith("FROM ")) hasFrom = true;
    const instr = upper.split(/\s+/)[0];
    if (instr && !validInstructions.includes(instr) && !instr.startsWith("#")) {
      issues.push(`Unknown instruction: ${instr}`);
    }
  }
  if (!hasFrom) issues.push("Missing FROM instruction");
  return {
    valid: issues.length === 0,
    issues,
  };
}
