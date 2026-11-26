"use client";
import { useEffect, useId, useRef, useState } from "react";
import { PREVIEW_TOURS } from "@/lib/marketing/previewTours";

function tryPlay(v: HTMLVideoElement) { try { void Promise.resolve(v.play()).catch(() => {}); } catch { /* autoplay may be refused; the poster and controls remain */ } }

/**
 * Tabbed walkthrough clips. Videos load only when the section is near view, loop muted while visible,
 * and stay paused with controls for reduced motion. Each tab has a text walkthrough.
 */
export function ProductTour({ heading = "See V19 in motion" }: { heading?: string }) {
  const id = useId();
  const [index, setIndex] = useState(0);
  const [near, setNear] = useState(false);
  const [reduced, setReduced] = useState(false);
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const tour = PREVIEW_TOURS[index];

  useEffect(() => {
    setReduced(typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = section.current;
    if (!el || typeof IntersectionObserver !== "function") { setNear(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setNear(true);
      const v = video.current;
      if (!v || reduced) return;
      if (entry.isIntersecting) tryPlay(v); else { try { v.pause(); } catch { /* ignore */ } }
    }, { rootMargin: "200px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    const v = video.current;
    if (!v || !near) return;
    try { v.load(); } catch { /* environments without media support */ }
    if (!reduced) tryPlay(v);
  }, [index, near, reduced]);

  const select = (next: number) => setIndex((next + PREVIEW_TOURS.length) % PREVIEW_TOURS.length);
  return (
    <section ref={section} className="product-tour" aria-labelledby={`${id}-title`} data-reveal-skip>
      <div className="product-tour-head">
        <p>// Walkthroughs</p>
        <h2 id={`${id}-title`}>{heading}</h2>
        <p className="product-tour-note">Recorded in a browser preview of the current desktop source with synthetic data. Some views arrive with the next desktop release; check your installed version.</p>
      </div>
      <div role="tablist" aria-label="Walkthroughs" className="product-tour-tabs" onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); select(index + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); select(index - 1); }
      }}>
        {PREVIEW_TOURS.map((t, i) => <button key={t.id} type="button" role="tab" id={`${id}-tab-${t.id}`} aria-selected={i === index} aria-controls={`${id}-panel`} tabIndex={i === index ? 0 : -1} onClick={() => setIndex(i)}>{t.label}</button>)}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tour.id}`} className="product-tour-panel">
        <div className="product-tour-frame">
          <video ref={video} key={tour.id} poster={tour.poster} muted loop playsInline preload="none" controls={reduced} aria-label={`${tour.label} walkthrough, ${tour.steps.length} steps`}>
            {near && <source src={tour.video} type="video/mp4" />}
          </video>
        </div>
        <div className="product-tour-copy">
          <p className="product-tour-summary">{tour.summary}</p>
          <ol>{tour.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      </div>
    </section>
  );
}
