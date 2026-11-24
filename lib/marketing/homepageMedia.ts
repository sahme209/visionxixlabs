const platformNames = { macos: "macOS", windows: "Windows", linux: "Linux" } as const;
type Platform = keyof typeof platformNames;

export function resolveHomepageMedia(manifest: unknown, hasAsset: (url: string) => boolean) {
  if (!manifest || typeof manifest !== "object") return null;
  const { title, version, platform, sourceCommit, durationSeconds, transcript } = manifest as Record<string, unknown>;
  if (
    typeof title !== "string" || !title.trim() ||
    typeof version !== "string" || !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(version) ||
    typeof platform !== "string" || !Object.hasOwn(platformNames, platform) ||
    typeof sourceCommit !== "string" || !/^[a-f0-9]{40}$/.test(sourceCommit) ||
    typeof durationSeconds !== "number" || !Number.isSafeInteger(durationSeconds) || durationSeconds <= 0 ||
    typeof transcript !== "string" || !transcript.trim()
  ) return null;

  const base = `/media/workspace/${version}/${platform}`;
  const poster = `${base}/poster.webp`;
  const video = `${base}/walkthrough.webm`;
  const captions = `${base}/captions.vtt`;
  if (![poster, video, captions].every(hasAsset)) return null;

  const duration = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;
  return { title, version, platform: platformNames[platform as Platform], sourceCommit, duration, transcript, poster, video, captions };
}
