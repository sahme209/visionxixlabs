/**
 * Redact secrets from contact messages before storing.
 * Detects AWS keys, GitHub tokens, generic tokens.
 */

const AWS_ACCESS_KEY_PATTERN = /(?:A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{16}/gi;
const AWS_SECRET_PATTERN = /[A-Za-z0-9/+=]{40}/g;
const GITHUB_TOKEN_PATTERN = /ghp_[A-Za-z0-9]{36}/g;
const GITHUB_OAUTH_PATTERN = /gho_[A-Za-z0-9]{36}/g;
const GENERIC_SECRET_PATTERN = /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{20,}['"]?/gi;

export function redactSecrets(text: string): string {
  if (!text || typeof text !== "string") return text;
  let out = text;
  out = out.replace(AWS_ACCESS_KEY_PATTERN, "[REDACTED-AWS-KEY]");
  out = out.replace(AWS_SECRET_PATTERN, "[REDACTED-SECRET]");
  out = out.replace(GITHUB_TOKEN_PATTERN, "[REDACTED-GH-TOKEN]");
  out = out.replace(GITHUB_OAUTH_PATTERN, "[REDACTED-GH-OAUTH]");
  out = out.replace(GENERIC_SECRET_PATTERN, "$1=[REDACTED]");
  return out;
}
