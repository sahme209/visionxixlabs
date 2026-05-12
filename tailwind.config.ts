import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'float': 'float 6s ease-in-out infinite',
        'beam': 'beam-sweep 8s ease-in-out infinite',
        'glow-pulse': 'pulse-glow 3s ease-in-out infinite',
        'border-flow': 'border-flow 4s ease infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'text-reveal': 'text-reveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'beam-sweep': {
          '0%': { transform: 'translateX(-100%) rotate(-45deg)' },
          '100%': { transform: 'translateX(200%) rotate(-45deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 16px rgba(124,58,237,0.15)' },
          '50%': { boxShadow: '0 0 28px rgba(124,58,237,0.35)' },
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'text-reveal': {
          from: { opacity: '0', transform: 'translateY(20px)', filter: 'blur(10px)' },
          to: { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
      },
      borderRadius: {
        'huly': '0.875rem',
        'huly-lg': '1.25rem',
      },
      backdropBlur: {
        'xs': '2px',
        'huly': '24px',
      },
    },
  },
  plugins: [],
};

export default config;
