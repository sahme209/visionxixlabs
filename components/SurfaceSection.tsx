"use client";

/**
 * SurfaceSection - Wrapper for contrast-aware sections
 * Use surface-dark for dark backgrounds (navy, gradients) so all text/icons inherit light foreground.
 * Use surface-light for light backgrounds to ensure dark text/icons.
 *
 * Usage:
 *   <SurfaceSection variant="dark" className="bg-[var(--hero-dark)] ...">
 *     <h2>Always readable on dark</h2>
 *     <Icon className="text-[var(--icon)]" />
 *   </SurfaceSection>
 *
 *   <SurfaceSection variant="light" className="bg-white ...">
 *     <p>Always readable on light</p>
 *   </SurfaceSection>
 */
export default function SurfaceSection({
  variant,
  children,
  className = "",
}: {
  variant: "dark" | "light";
  children: React.ReactNode;
  className?: string;
}) {
  const surfaceClass = variant === "dark" ? "surface-dark" : "surface-light";
  return <div className={`${surfaceClass} ${className}`.trim()}>{children}</div>;
}
