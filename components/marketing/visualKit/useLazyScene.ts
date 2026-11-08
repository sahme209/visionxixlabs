"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { forced3d, prefersReducedMotion, supportsWebGL } from "../webglSupport";

export type SceneMode = "pending" | "3d" | "2d";
export type LazySceneHandle = { setVisible(visible: boolean): void; dispose(): void };

/**
 * Shared lifecycle for every v4 model:
 * 2D unless WebGL runs on a real GPU; loads the scene only near view; pauses off-screen;
 * falls back to 2D on import failure or a slow frame budget; disposes on unmount.
 * `load` dynamically imports the model's scene and creates it with the provided helpers.
 */
export function useLazyScene<H extends LazySceneHandle>(
  load: (canvas: HTMLCanvasElement, env: { reducedMotion: boolean; frameGuard: boolean; onTooSlow(): void }) => Promise<H>,
): { mode: SceneMode; reducedMotion: boolean; frameRef: RefObject<HTMLDivElement | null>; canvasRef: RefObject<HTMLCanvasElement | null>; sceneRef: RefObject<H | null> } {
  const [mode, setMode] = useState<SceneMode>("pending");
  const [reducedMotion, setReducedMotion] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<H | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());
    const force = forced3d();
    if ((!force && !supportsWebGL()) || typeof IntersectionObserver === "undefined") { setMode("2d"); return; }
    let cancelled = false;
    const frame = frameRef.current;
    if (!frame) return;
    const fallback = () => { sceneRef.current?.dispose(); sceneRef.current = null; setMode("2d"); };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      const canvas = canvasRef.current;
      if (!canvas) return;
      loadRef.current(canvas, { reducedMotion: prefersReducedMotion(), frameGuard: !force, onTooSlow: fallback })
        .then((handle) => { if (cancelled) { handle.dispose(); return; } sceneRef.current = handle; setMode("3d"); })
        .catch(() => { if (!cancelled) setMode("2d"); });
    }, { rootMargin: "300px" });
    observer.observe(frame);
    const visibility = new IntersectionObserver((entries) => sceneRef.current?.setVisible(entries.some((e) => e.isIntersecting)));
    visibility.observe(frame);
    return () => {
      cancelled = true; observer.disconnect(); visibility.disconnect();
      sceneRef.current?.dispose(); sceneRef.current = null;
    };
  }, []);

  return { mode, reducedMotion, frameRef, canvasRef, sceneRef };
}
