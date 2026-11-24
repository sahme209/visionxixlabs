import { redactSecrets } from "@/lib/ai/contextRedaction";

const SECRET_PATTERNS = [/\bvxlk_(live|test)_[A-Za-z0-9]{8,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bsk-[A-Za-z0-9-_]{20,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bxox[baprs]-[A-Za-z0-9-]{10,}/, /\b(password|passwd|pwd)\s*[:=]\s*\S{4,}/i];

export const SUPPORT_SECRET_NOTICE = "That message looks like it contains a password, key or token. Don't share secrets in chat. If it's real, rotate it now. I didn't store it, and I won't use it.";

export function containsSupportSecret(text: string): boolean {
  return SECRET_PATTERNS.some(pattern => pattern.test(text)) || redactSecrets(text).text !== text;
}
