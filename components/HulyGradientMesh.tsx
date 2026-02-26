"use client";

/**
 * Huly-inspired floating gradient mesh / blob background.
 * Soft animated orbs that add depth and energy to hero/banner sections.
 */
export default function HulyGradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Large soft blob - azure */}
      <div
        className="absolute -top-24 -left-32 w-[400px] h-[400px] rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(0, 113, 227, 0.4) 0%, transparent 70%)",
          filter: "blur(60px)",
          animation: "huly-blob-float 18s ease-in-out infinite",
        }}
      />
      {/* Violet blob - right side */}
      <div
        className="absolute top-1/4 -right-24 w-[320px] h-[320px] rounded-full opacity-35"
        style={{
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, transparent 70%)",
          filter: "blur(50px)",
          animation: "huly-blob-float 22s ease-in-out infinite 2s",
        }}
      />
      {/* Purple accent - bottom */}
      <div
        className="absolute -bottom-16 left-1/3 w-[280px] h-[280px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
          filter: "blur(55px)",
          animation: "huly-blob-float 20s ease-in-out infinite 4s",
        }}
      />
      {/* Subtle center glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(ellipse 80% 50%, rgba(0, 113, 227, 0.25) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "huly-blob-pulse 8s ease-in-out infinite",
        }}
      />
    </div>
  );
}
