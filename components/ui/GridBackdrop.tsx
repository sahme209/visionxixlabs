"use client";

type GridBackdropProps = {
  className?: string;
  opacity?: number;
};

export function GridBackdrop({ className = "", opacity = 0.4 }: GridBackdropProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 rounded-2xl [background-image:linear-gradient(rgba(124,58,237,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(124,58,237,0.03)_1px,transparent_1px)] [background-size:12px_12px] ${className}`}
      style={{ opacity }}
      aria-hidden
    />
  );
}
