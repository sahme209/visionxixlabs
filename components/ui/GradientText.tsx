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
  from = "#f54e00",
  to = "#f54e00",
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
