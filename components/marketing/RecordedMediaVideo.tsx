"use client";

import { useState } from "react";

type RecordedMediaVideoProps = {
  title: string;
  poster: string;
  video: string;
  captions: string;
};

export function RecordedMediaVideo({ title, poster, video, captions }: RecordedMediaVideoProps) {
  const [unavailable, setUnavailable] = useState(false);

  return (
    <>
      <video
        className="aspect-video w-full bg-black"
        controls
        playsInline
        preload="none"
        poster={poster}
        src={video}
        aria-label={title}
        onError={() => setUnavailable(true)}
        onPlaying={() => setUnavailable(false)}
      >
        <track kind="captions" src={captions} srcLang="en" label="English" default />
      </video>
      <div role="status">
        {unavailable && (
          <p className="px-5 pt-4 text-sm text-zinc-200">
            The video couldn’t play. The transcript is available below.
          </p>
        )}
      </div>
    </>
  );
}
