/** Non-secret local navigation metadata only. No file content, drafts or
 * credentials. A saved path is a hint and must match fresh native inventory. */
export interface LocalWorkspaceSelection { root: string; checkout: string }

export function localWorkspaceSelectionKey(apiBase: unknown, workspace: unknown, user: unknown): string | null {
  if (typeof apiBase !== "string" || typeof workspace !== "string" || !workspace || workspace.length > 200
    || typeof user !== "string" || !user.trim() || user.length > 320) return null;
  try {
    const url = new URL(apiBase);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    return `axiom.local.workspace.v1:${encodeURIComponent(JSON.stringify([url.origin + url.pathname, workspace, user.trim().toLowerCase()]))}`;
  } catch { return null; }
}

export function readLocalWorkspaceSelection(key: string | null): LocalWorkspaceSelection | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length > 17000) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 2
      || ![value.root, value.checkout].every(path => typeof path === "string" && path.length > 0
        && path.length <= 8192 && !/[\x00-\x1f\x7f]/.test(path))) return null;
    return { root: value.root, checkout: value.checkout };
  } catch { return null; }
}

export function writeLocalWorkspaceSelection(key: string | null, value: LocalWorkspaceSelection): void {
  if (key) try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Session-only navigation remains available. */ }
}

export async function resolveLocalWorkspaceSelection(
  selection: LocalWorkspaceSelection | null,
  roots: readonly string[],
  listWorktrees: (root: string) => Promise<readonly { path: string }[]>,
): Promise<string | null> {
  if (!selection || !roots.includes(selection.root)) return null;
  if (selection.checkout === selection.root) return selection.root;
  try {
    const rows = await listWorktrees(selection.root);
    return rows.some(row => row.path === selection.checkout) ? selection.checkout : selection.root;
  } catch { return selection.root; }
}
