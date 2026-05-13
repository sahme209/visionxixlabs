/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        axiom: {
          bg: "#09090b",
          surface: "#18181b",
          border: "#27272a",
          accent: "#8b5cf6",
          "accent-dim": "#6d28d9",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
