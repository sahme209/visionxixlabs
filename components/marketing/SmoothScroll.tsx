"use client";
import { useEffect } from "react";
import { clampScroll, smoothScrollAllowed, stepToward, wheelPixels } from "@/lib/marketing/smoothScrollModel";

/** Is the wheel meant for an inner scroller (code block, sidebar, menu) rather than the page? */
function wantsOwnScroll(target: EventTarget | null, deltaY: number): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.documentElement; el = el.parentElement) {
    if (el.closest("[data-smooth-scroll-prevent]")) return true;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      const atTop = el.scrollTop <= 0, atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
    }
  }
  return false;
}

/**
 * Inertial wheel scrolling for public pages on desktop (the Exact template's premium scroll).
 * Keyboard, scrollbar, anchors, touch and reduced motion keep native behaviour; nothing here changes layout.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!smoothScrollAllowed({ reducedMotion: reduce.matches, finePointer: fine.matches })) return;
    let target = window.scrollY, current = window.scrollY, frame = 0, ours = false;
    const max = () => document.documentElement.scrollHeight - window.innerHeight;
    const tick = () => {
      const { next, done } = stepToward(current, target);
      current = next; ours = true;
      window.scrollTo({ top: current, behavior: "instant" });
      frame = done ? 0 : requestAnimationFrame(tick);
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.defaultPrevented || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (reduce.matches || wantsOwnScroll(event.target, event.deltaY)) return;
      event.preventDefault();
      if (!frame) current = window.scrollY;
      target = clampScroll((frame ? target : window.scrollY) + wheelPixels(event.deltaY, event.deltaMode, window.innerHeight), max());
      if (!frame) frame = requestAnimationFrame(tick);
    };
    // Keyboard, scrollbar drags, anchor jumps and focus scrolling are native; follow them instead of fighting them.
    const onScroll = () => {
      if (ours) { ours = false; return; }
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      target = current = window.scrollY;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.dataset.smoothScroll = "on";
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      delete document.documentElement.dataset.smoothScroll;
    };
  }, []);
  return null;
}
