"use client";

import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* reducedMotion="user" makes every motion.* / AnimatePresence
          component site-wide honor the OS-level prefers-reduced-motion
          setting automatically — components/motion/Reveal.tsx and
          Stagger.tsx already checked this individually, but ~16 other
          files call framer-motion directly without going through
          either wrapper. This is framer-motion's own documented fix
          for exactly that gap: no visual change for users who haven't
          opted into reduced motion, animations collapse to instant
          state changes for users who have. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </SessionProvider>
  );
}
