"use client";

export function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
      <div className="absolute inset-0 bg-dots opacity-50" aria-hidden />
      <div className="absolute inset-0 bg-grid-mesh opacity-40" aria-hidden />

      {/* Top-right — violet with rotation */}
      <div
        className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/[0.14] blur-3xl animate-blob-rotate"
        aria-hidden
      />

      {/* Bottom-left — fuchsia with rotation */}
      <div
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/[0.12] blur-3xl animate-blob-rotate-delayed"
        aria-hidden
      />

      {/* Center — deep violet, standard float */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-violet-700/[0.08] blur-3xl animate-blob"
        style={{ animationDelay: "-2s" }}
        aria-hidden
      />

      {/* Spotlight orb */}
      <div className="absolute inset-x-0 top-0 h-[60vh] spotlight-orb" aria-hidden />

      {/* Bottom-right — fuchsia accent with rotation */}
      <div
        className="absolute -bottom-20 right-1/4 w-[300px] h-[300px] rounded-full bg-fuchsia-500/[0.08] blur-3xl animate-blob-rotate"
        style={{ animationDelay: "-6s" }}
        aria-hidden
      />

      {/* Extra: top-left — subtle violet glow, slow float */}
      <div
        className="absolute -top-20 left-1/4 w-[350px] h-[350px] rounded-full bg-violet-500/[0.06] blur-3xl animate-blob-rotate-delayed"
        style={{ animationDelay: "-12s" }}
        aria-hidden
      />
    </div>
  );
}
