"use client";

import { useEffect, useState, type RefObject } from "react";
import type { StoryStep } from "./workflowStories";

export const STORY_STEP_MS = 5400;
const initial = { index: 0, elapsed: 0, playing: false };

/** One clock owns typing, cursor and progress. No background or approval timers. */
export function useStoryPlayback(steps: readonly StoryStep[], container: RefObject<HTMLElement | null>) {
  const [state, setState] = useState(initial);
  // Static SSR and first client frame; motion starts only on an explicit Play.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(media.matches); if (media.matches) setState(current => ({ ...current, playing: false })); };
    const visibility = () => setDocumentVisible(!document.hidden);
    update(); visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.1 });
    if (container.current) observer?.observe(container.current);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); observer?.disconnect(); };
  }, [container]);
  const active = state.playing && !reducedMotion && visible && documentVisible;
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setState(current => {
      const elapsed = Math.min(STORY_STEP_MS, current.elapsed + 60);
      if (elapsed < STORY_STEP_MS) return { ...current, elapsed };
      if (steps[current.index].review || current.index === steps.length - 1) return { ...current, elapsed, playing: false };
      return { ...current, index: current.index + 1, elapsed: 0 };
    }), 60);
    return () => window.clearInterval(timer);
  }, [active, steps]);
  function choose(next: number) { setState({ index: Math.max(0, Math.min(steps.length - 1, next)), elapsed: STORY_STEP_MS, playing: false }); }
  function reset() { setState(initial); }
  function replay() { setState({ ...initial, playing: !reducedMotion }); }
  function toggle() { if (reducedMotion) return; setState(current => ({ ...current, elapsed: !current.playing && current.elapsed >= STORY_STEP_MS ? 0 : current.elapsed, playing: !current.playing })); }
  return { ...state, active, reducedMotion, choose, reset, replay, toggle,
    fraction: reducedMotion || (!state.playing && state.elapsed === 0) ? 1 : state.elapsed / STORY_STEP_MS };
}
