"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type StaggerChildrenProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  threshold?: number;
};

export function StaggerChildren({
  children,
  className = "",
  staggerDelay = 80,
  threshold = 0.1,
}: StaggerChildrenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div ref={ref} className={className}>
      {childArray.map((child, i) => (
        <div
          key={i}
          className={`transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{
            transitionDelay: visible ? `${i * staggerDelay}ms` : "0ms",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
