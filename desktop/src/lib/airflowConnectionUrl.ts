/** Form validation only. The service separately verifies public DNS and access. */
export function isAirflowDeploymentUrl(value: string): boolean {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const raw = trimmed.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
    if (!raw || url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return false;
    return /^(?:\/|\/[A-Za-z0-9_-]+\/?)?$/.test(raw[1]) && !/^\/(?:api|auth|home)\/?$/i.test(raw[1]);
  } catch { return false; }
}
