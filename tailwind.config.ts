import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand tokens — coral is the warm accent against violet/cool background.
        // Use these instead of hard-coded hex/rgb so palette changes cascade.
        brand: {
          coral:     '#F472B6',  // rose-400 — warm accent (Huly-style)
          'coral-deep': '#EC4899', // rose-500 — used for emphasis
          violet:    '#8B5CF6',  // violet-500 — primary
          'violet-deep': '#7C3AED', // violet-600
          ink:       '#0A0A0D',  // page background
          'ink-card': '#0F0F12', // card surface
          hairline:  'rgba(255,255,255,0.06)',
          'hairline-strong': 'rgba(255,255,255,0.10)',
        },
      },
      backgroundImage: {
        // Huly-style gradient utility — use as `bg-huly-warm`
        'huly-warm':  'linear-gradient(135deg, rgba(244,114,182,0.18) 0%, rgba(139,92,246,0.18) 100%)',
        'huly-cool':  'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(56,189,248,0.14) 100%)',
        'huly-aurora':
          'radial-gradient(40% 50% at 20% 30%, rgba(139,92,246,0.32), transparent 60%),' +
          'radial-gradient(35% 40% at 80% 60%, rgba(244,114,182,0.26), transparent 60%),' +
          'radial-gradient(30% 30% at 50% 90%, rgba(56,189,248,0.18), transparent 60%)',
        'huly-coral-fade': 'linear-gradient(90deg, #F472B6 0%, #8B5CF6 60%, transparent 100%)',
      },
      boxShadow: {
        'huly-card':       '0 12px 40px -16px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05) inset',
        'huly-coral-glow': '0 20px 60px -20px rgba(244,114,182,0.35)',
        'huly-violet-glow':'0 20px 60px -20px rgba(139,92,246,0.40)',
      },
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
