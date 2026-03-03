"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CloudIcon } from "@heroicons/react/24/outline";
import { motionConfig, motionDurations, prefersReducedMotionQuery } from "@/lib/motion/tokens";

type AxiomLoadingStateProps = {
  message?: string;
  variant?: "full" | "inline" | "minimal" | "compact";
  showCloudIcons?: boolean;
};

export function AxiomLoadingState({
  message = "Loading Axiom AI cloud analysis…",
  variant = "full",
  showCloudIcons = true,
}: AxiomLoadingStateProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia(prefersReducedMotionQuery);
    setReduceMotion(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  const duration = reduceMotion ? 0 : motionConfig.duration;
  const stepMs = 800;
  const steps = ["Connecting to cloud…", "Analyzing infrastructure…", "Generating insights…"];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, stepMs);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const displayMessage =
    variant === "inline" ? "Generating your Operator plan…" : variant === "compact" ? "Calculating metrics…" : message;
  const stagedMessage = variant === "full" && !reduceMotion ? steps[stepIndex] : displayMessage;

  return (
    <div
      className={`flex flex-col items-center justify-center ${
        variant === "full"
          ? "min-h-[280px] space-y-8"
          : variant === "inline"
            ? "space-y-6 py-2"
            : variant === "compact"
              ? "space-y-2 py-2"
              : "space-y-4"
      }`}
    >
      {showCloudIcons && variant !== "minimal" && variant !== "compact" && (
        <div className="flex items-center justify-center gap-3">
          {["AWS", "Azure", "GCP"].map((label, i) => (
            <motion.div
              key={label}
              className="flex flex-col items-center gap-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: duration || motionDurations.short,
                delay: reduceMotion ? 0 : i * 0.12,
                ease: motionConfig.ease,
              }}
            >
              <motion.div
                className="rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-600/50 shadow-sm px-4 py-2.5 flex items-center gap-2"
                animate={
                  reduceMotion
                    ? {}
                    : {
                        scale: [1, 1.03, 1],
                        boxShadow: [
                          "0 1px 3px 0 rgb(0 0 0 / 0.05)",
                          "0 4px 12px -2px rgb(99 102 241 / 0.15)",
                          "0 1px 3px 0 rgb(0 0 0 / 0.05)",
                        ],
                      }
                }
                transition={{
                  duration: 2.4,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              >
                <CloudIcon className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
              </motion.div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center max-w-xs">
          {stagedMessage}
        </p>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-indigo-500/70 dark:bg-indigo-400/70"
              animate={
                reduceMotion
                  ? {}
                  : {
                      opacity: [0.4, 1, 0.4],
                      scale: [0.9, 1.1, 0.9],
                    }
              }
              transition={{
                duration: 0.8,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>

      {variant === "full" && !reduceMotion && (
        <motion.div
          className="h-1 w-48 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration || motionDurations.short }}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            animate={
              reduceMotion
                ? { width: "60%" }
                : {
                    width: ["0%", "70%", "95%", "70%", "0%"],
                  }
            }
            transition={{
              duration: 2.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      )}

      {variant === "inline" && (
        <div className="grid grid-cols-5 gap-3 w-full max-w-2xl">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              className="h-24 rounded-xl bg-slate-200/80 dark:bg-slate-700/80"
              animate={
                reduceMotion
                  ? {}
                  : {
                      opacity: [0.6, 1, 0.6],
                    }
              }
              transition={{
                duration: 1.2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
