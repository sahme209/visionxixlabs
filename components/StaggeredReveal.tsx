"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

type StaggeredRevealProps = {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
  threshold?: number;
};

export function StaggeredReveal({
  children,
  className = "",
  staggerMs = 80,
  threshold = 0.1,
}: StaggeredRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setRevealed(true);
      },
      { threshold, rootMargin: "0px 0px -50px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const childArray = Children.toArray(children);

  return (
    <div ref={ref} className={className}>
      {childArray.map((child, i) => (
        <div
          key={i}
          className={`stagger-reveal ${revealed ? "revealed" : ""}`}
          style={{
            animationDelay: revealed ? `${i * staggerMs}ms` : "0ms",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
