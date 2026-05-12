"use client";

type GradientTextProps = {
  children: React.ReactNode;
  className?: string;
  from?: string;
  to?: string;
};

export function GradientText({
  children,
  className = "",
  from = "#7c3aed",
  to = "#d946ef",
}: GradientTextProps) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-gradient-to-r ${className}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {children}
    </span>
  );
}
