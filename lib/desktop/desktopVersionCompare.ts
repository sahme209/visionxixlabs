/** Compare the installed desktop version with the latest published release tag ("desktop-v0.1.25"). Pure. */
export type UpdateState = { kind: "current"; latest: string } | { kind: "available"; latest: string } | { kind: "ahead"; latest: string } | { kind: "unknown" };

function parse(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match ? match.slice(1).map(Number) : null;
}

export function desktopUpdateState(installed: string | null | undefined, latestTag: string | null | undefined): UpdateState {
  const latest = latestTag?.replace(/^desktop-/, "") ?? "";
  const a = installed ? parse(installed) : null, b = parse(latest);
  if (!a || !b) return { kind: "unknown" };
  const clean = b.join(".");
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return { kind: "available", latest: clean };
    if (a[i] > b[i]) return { kind: "ahead", latest: clean };
  }
  return { kind: "current", latest: clean };
}
