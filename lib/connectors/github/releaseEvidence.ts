/**
 * Narrow, read-only GitHub evidence helpers.
 *
 * This module deliberately accepts only canonical github.com repository and
 * pull-request URLs already recorded in a governed deployment request. It
 * turns them into API-safe identifiers so release evidence collection cannot
 * become an arbitrary URL fetch (SSRF) capability.
 */

export interface GithubRepositoryRef {
  owner: string;
  repository: string;
}

export interface GithubPullRequestRef extends GithubRepositoryRef {
  number: number;
}

const GITHUB_HOST = "github.com";
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

function parseGithubUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== GITHUB_HOST) return null;
    if (url.username || url.password || url.port || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function safePart(value: string | undefined): string | null {
  try {
    const decoded = value ? decodeURIComponent(value) : "";
    return IDENTIFIER.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Parses exactly https://github.com/{owner}/{repo}[.git]. */
export function parseGithubRepositoryUrl(value: string): GithubRepositoryRef | null {
  const url = parseGithubUrl(value);
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const owner = safePart(parts[0]);
  const repository = safePart(parts[1]?.replace(/\.git$/i, ""));
  return owner && repository ? { owner, repository } : null;
}

/** Parses exactly https://github.com/{owner}/{repo}/pull/{positive-number}. */
export function parseGithubPullRequestUrl(value: string): GithubPullRequestRef | null {
  const url = parseGithubUrl(value);
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 4 || parts[2] !== "pull") return null;
  const owner = safePart(parts[0]);
  const repository = safePart(parts[1]);
  const number = Number(parts[3]);
  if (!owner || !repository || !Number.isSafeInteger(number) || number < 1) return null;
  return { owner, repository, number };
}

export function sameGithubRepository(a: GithubRepositoryRef, b: GithubRepositoryRef): boolean {
  return a.owner.toLowerCase() === b.owner.toLowerCase()
    && a.repository.toLowerCase() === b.repository.toLowerCase();
}

export function uniqueGithubRepositories(urls: readonly string[], limit = 10): GithubRepositoryRef[] {
  const output: GithubRepositoryRef[] = [];
  for (const value of urls) {
    const ref = parseGithubRepositoryUrl(value);
    if (!ref || output.some((known) => sameGithubRepository(known, ref))) continue;
    output.push(ref);
    if (output.length >= limit) break;
  }
  return output;
}
