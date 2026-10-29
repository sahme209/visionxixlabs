/** A browser preference, never membership or execution authority. */
export const WORKSPACE_COOKIE = "axiom.workspace.v1";
export function readWorkspaceSelection(value: string | undefined, userId: string): string | null {
  if (!value || value.length > 1024) return null;
  try {
    const selected = JSON.parse(value);
    return selected?.userId === userId && typeof selected.organizationId === "string"
      && /^[A-Za-z0-9_-]{1,200}$/.test(selected.organizationId) ? selected.organizationId : null;
  } catch { return null; }
}
