"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * framer.com-style appear-on-scroll for public marketing pages: sections below the fold rise and fade in
 * once as they enter view. Content is fully visible without JavaScript, above the fold, in docs, and with
 * reduced motion; nothing is ever left hidden if the observer is unavailable.
 */
export function ScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith("/docs") || typeof window.matchMedia !== "function" || typeof IntersectionObserver !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = [...document.querySelectorAll<HTMLElement>("main > section, main > div > section, main [data-reveal]")]
      .filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.9 && !el.closest("[data-reveal-skip]"));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.reveal = "shown";
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    for (const el of targets) { el.dataset.reveal = "pending"; observer.observe(el); }
    // Safety net: anything still pending after a while (print, odd layouts) becomes visible.
    const failsafe = window.setTimeout(() => targets.forEach((el) => { if (el.dataset.reveal === "pending") el.dataset.reveal = "shown"; }), 8000);
    const showAll = () => targets.forEach((el) => { el.dataset.reveal = "shown"; });
    window.addEventListener("beforeprint", showAll);
    return () => { observer.disconnect(); window.clearTimeout(failsafe); window.removeEventListener("beforeprint", showAll); targets.forEach((el) => { delete el.dataset.reveal; }); };
  }, [pathname]);
  return null;
}
