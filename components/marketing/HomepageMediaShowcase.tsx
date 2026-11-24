import { statSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { ReactNode } from "react";
import homepageMedia from "@/lib/marketing/homepage-media.json";
import { resolveHomepageMedia } from "@/lib/marketing/homepageMedia";
import { RecordedMediaVideo } from "./RecordedMediaVideo";

const mediaDirectory = path.join(process.cwd(), "public/media/workspace");

function hasLocalAsset(url: string) {
  try {
    const file = statSync(path.join(mediaDirectory, url.slice("/media/workspace/".length)));
    return file.isFile() && file.size > 0;
  } catch {
    return false;
  }
}

export function HomepageMediaShowcase({ fallback }: { fallback: ReactNode }) {
  const media = resolveHomepageMedia(homepageMedia, hasLocalAsset);
  if (!media) return <>{fallback}</>;

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/12 bg-[#171714]">
      <figcaption className="space-y-2 px-5 py-4">
        <h3 className="text-lg font-medium text-zinc-100">{media.title}</h3>
        <p className="text-sm text-zinc-300">
          Recorded on V19 {media.version} · {media.platform} · {media.duration}
        </p>
        <p className="text-xs text-zinc-400">Build source <code title={media.sourceCommit}>{media.sourceCommit.slice(0, 8)}</code></p>
      </figcaption>
      <RecordedMediaVideo
        title={media.title}
        poster={media.poster}
        video={media.video}
        captions={media.captions}
      />
      <div className="space-y-3 px-5 py-4 text-sm text-zinc-200">
        <details>
          <summary className="w-fit cursor-pointer rounded-sm py-2">Read transcript</summary>
          <p className="whitespace-pre-line leading-7 text-zinc-300">{media.transcript}</p>
        </details>
        <Link href="/demo" className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4">Open the scripted tour</Link>
      </div>
    </figure>
  );
}
