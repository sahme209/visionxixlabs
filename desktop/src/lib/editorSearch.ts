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
/** Single occurrence, literal replacement, no regex or automatic persistence. */
export function replaceEditorMatch(content: string, query: string, replacement: string, offset: number): string | null {
  if (!query || query.length > 256 || replacement.length > 8000 || !Number.isSafeInteger(offset) || offset < 0
    || content.slice(offset, offset + query.length) !== query) return null;
  const next = content.slice(0, offset) + replacement + content.slice(offset + query.length);
  return new TextEncoder().encode(next).length <= 1_000_000 ? next : null;
}
