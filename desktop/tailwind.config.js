/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        axiom: {
          bg:           "#09090b",
          "bg-elev":    "#0c0c10",
          surface:      "#0f0f14",
          "surface-2":  "#13131a",
          border:       "#1f1f27",
          "border-soft":"#1a1a22",
          accent:       "#8b5cf6",
          "accent-dim": "#6d28d9",
          "accent-glow":"#a78bfa",
          violet:       "#8b5cf6",
          fuchsia:      "#d946ef",
          cyan:         "#22d3ee",
          emerald:      "#10b981",
          amber:        "#f59e0b",
          rose:         "#f43f5e",
          success:      "#10b981",
          warning:      "#f59e0b",
          danger:       "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      backgroundImage: {
        "axiom-mesh": "radial-gradient(circle at 20% 10%, rgba(139,92,246,0.10), transparent 50%), radial-gradient(circle at 80% 80%, rgba(217,70,239,0.07), transparent 50%), radial-gradient(circle at 50% 50%, rgba(34,211,238,0.05), transparent 60%)",
        "axiom-hero": "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(217,70,239,0.08) 50%, rgba(34,211,238,0.06) 100%)",
      },
      boxShadow: {
        "glow-violet": "0 0 24px -4px rgba(139,92,246,0.4)",
        "glow-cyan":   "0 0 24px -4px rgba(34,211,238,0.4)",
        "cinematic":   "0 30px 80px -20px rgba(139,92,246,0.25), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-lift":   "0 20px 40px -20px rgba(0,0,0,0.6)",
      },
      animation: {
        "pulse-glow":    "pulse-glow 2.5s ease-in-out infinite",
        "fade-in":       "fade-in 0.3s ease-out forwards",
        "fade-in-up":    "fade-in-up 0.4s ease-out forwards",
        "scan-line":     "scan-line 3s linear infinite",
        "shimmer":       "shimmer 2s linear infinite",
        "aurora":        "aurora 12s ease-in-out infinite",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%":      { transform: "translate(-2%, 2%) rotate(2deg)" },
        },
      },
    },
  },
  plugins: [],
};
