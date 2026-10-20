/** Literal, case-sensitive, non-overlapping matches; no regular-expression execution. */
export function editorMatches(content: string, query: string): { offsets: number[]; limited: boolean } {
  const offsets: number[] = [];
  if (!query || query.length > 256) return { offsets, limited: false };
  let cursor = 0;
  while (cursor <= content.length) {
    const found = content.indexOf(query, cursor);
    if (found < 0) break;
    if (offsets.length === 1000) return { offsets, limited: true };
    offsets.push(found); cursor = found + query.length;
  }
  return { offsets, limited: false };
}
