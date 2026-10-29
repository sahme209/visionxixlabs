/** Review only known, bounded fields of the exact integrity-bound PR proposal. */
export function pullRequestProposalReview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const args = value as Record<string, unknown>;
  const text = (value: unknown, limit: number): value is string => typeof value === "string" && value.length > 0 && value.length <= limit && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
  const ref = (value: unknown): value is string => text(value, 255) && !/\s|\.\.|[~^:?*\[\\]/.test(value) && !value.startsWith("/") && !value.endsWith("/");
  if (typeof args.repositoryFullName !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(args.repositoryFullName)
    || !ref(args.head) || !ref(args.base) || !text(args.title, 256) || /[\r\n]/.test(args.title)
    || (args.body !== undefined && args.body !== "" && !text(args.body, 65000))) return null;
  return { repository: args.repositoryFullName, head: args.head, base: args.base, title: args.title, body: typeof args.body === "string" ? args.body : "" };
}
