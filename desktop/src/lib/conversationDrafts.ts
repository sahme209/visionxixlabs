/** Session-local prompt cache. Refuse overflow rather than silently evict unsent work. */
export function rememberConversationDraft(drafts: ReadonlyMap<string, string>, id: string, text: string): Map<string, string> | null {
  const next = new Map(drafts);
  if (text) next.set(id, text); else next.delete(id);
  if (next.size > 20 || [...next.values()].reduce((sum, value) => sum + value.length, 0) > 500000) return null;
  return next;
}
