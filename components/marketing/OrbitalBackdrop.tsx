"use client";

import { useEffect, useRef, useState } from "react";
import type { OrbitSceneHandle } from "./orbitScene/createOrbitScene";

/** Static original art is always available; WebGL is optional enhancement. */
export function OrbitalBackdrop() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbitSceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cancelled = false, visible = true, failedPermanently = false;
    let entranceFinished = false, entranceTimer: number | undefined;
    const sync = () => {
      if (cancelled) return;
      const stopped = entranceFinished || media.matches || document.hidden || !visible;
      setActive(!stopped && sceneRef.current !== null);
      sceneRef.current?.setPaused(stopped);
    };
    const resize = () => { const rect = root.getBoundingClientRect(); sceneRef.current?.resize(rect.width, rect.height); };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting); sync();
    });
    observer?.observe(root);
    const sizes = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    sizes?.observe(root);
    if (!sizes) window.addEventListener("resize", resize);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    // Reduced-motion starts with static art and avoids allocating a GPU context.
    const load = () => {
      if (cancelled || failedPermanently || media.matches || sceneRef.current) return;
      import("./orbitScene/createOrbitScene").then(({ createOrbitScene }) => {
        if (cancelled || failedPermanently || media.matches || sceneRef.current) return;
        let failed = false;
        const scene = createOrbitScene(canvas, () => {
          failed = true; failedPermanently = true;
          window.clearTimeout(entranceTimer);
          sceneRef.current = null;
          if (!cancelled) { setReady(false); setActive(false); }
        });
        if (cancelled || failed) { scene.dispose(); return; }
        sceneRef.current = scene; setReady(true); resize(); sync();
        if (failedPermanently) return;
        // A single brief entrance settles into still artwork; no perpetual player UI.
        entranceTimer = window.setTimeout(() => { entranceFinished = true; sync(); }, 4000);
      }).catch(() => { failedPermanently = true; if (!cancelled) { setReady(false); setActive(false); } });
    };
    const motionChanged = () => { sync(); load(); };
    media.addEventListener("change", motionChanged);
    sync(); load();
    return () => {
      cancelled = true;
      window.clearTimeout(entranceTimer);
      observer?.disconnect(); sizes?.disconnect();
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", sync); media.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", sync);
      sceneRef.current?.dispose(); sceneRef.current = null;
    };
  }, []);

  return <div ref={rootRef} className={`orbit-backdrop${ready ? " orbit-backdrop--ready" : ""}${active ? " orbit-backdrop--active" : ""}`}>
    <div className="orbit-sky" aria-hidden="true">
      <svg viewBox="0 0 1440 850" preserveAspectRatio="none" className="orbit-fallback">
        <defs>
          <radialGradient id="axiom-vortex-surface" cx="57%" cy="38%"><stop offset=".12" stopColor="#0a0908"/><stop offset=".26" stopColor="#171615"/><stop offset=".48" stopColor="#171615"/><stop offset=".7" stopColor="#171615"/><stop offset="1" stopColor="#0a0908"/></radialGradient>
          <linearGradient id="axiom-vortex-crest"><stop stopColor="#858585" stopOpacity="0"/><stop offset=".7" stopColor="#bfbdb6" stopOpacity=".7"/><stop offset="1" stopColor="#858585" stopOpacity="0"/></linearGradient>
        </defs>
        <g transform="translate(720 110) rotate(-5)">
          <ellipse rx="680" ry="250" fill="url(#axiom-vortex-surface)"/>
          <ellipse cx="35" cy="-10" rx="190" ry="72" fill="#0a0908"/>
          <path d="M-160 2C-120 95 175 108 245 4" stroke="url(#axiom-vortex-crest)" strokeWidth="1.7" fill="none"/>
          <path d="M-400-30C-340 150 360 202 500 20M-530-15C-410 220 510 270 610 55" stroke="#858585" strokeOpacity=".12" strokeWidth=".8" fill="none"/>
        </g>
      </svg>
      <canvas ref={canvasRef} />

    </div>
    <div className="orbit-shade" aria-hidden="true" />
  </div>;
}
