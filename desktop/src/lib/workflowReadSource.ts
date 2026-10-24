/** Resolve only one explicit public-GitHub repository, never a ticket guess or credential URL. */
export function singleGithubRepository(value: string): string {
  const urls = value.split(/[,\n]/).map(item => item.trim()).filter(Boolean);
  if (urls.length !== 1) return "";
  try {
    const url = new URL(urls[0]);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return "";
    const path = url.pathname.replace(/\/$/, "").replace(/\.git$/, "");
    return /^\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(path) ? path.slice(1) : "";
  } catch { return ""; }
}
export function workflowFilePath(value: string): string {
  const name = value.trim();
  if (/^[A-Za-z0-9_][A-Za-z0-9_. -]{0,150}\.ya?ml$/.test(name)) return `.github/workflows/${name}`;
  return /^\.github\/workflows\/[A-Za-z0-9_][A-Za-z0-9_. -]{0,150}\.ya?ml$/.test(name) ? name : "";
}
