"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type AnimateOnScrollProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
  /** Enable blur fade-in variant (blur 8px -> 0) */
  blur?: boolean;
};

export function AnimateOnScroll({
  children,
  className = "",
  delay = 0,
  threshold = 0.1,
  blur = false,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timeoutId = setTimeout(() => setVisible(true), delay);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [delay, threshold]);

  const baseClass = blur ? "animate-on-scroll-blur" : "animate-on-scroll";

  return (
    <div
      ref={ref}
      className={`${baseClass} ${visible ? "visible" : ""} ${className}`}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
