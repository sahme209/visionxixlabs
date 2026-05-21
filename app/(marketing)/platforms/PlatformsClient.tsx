"use client";

import { motion } from "framer-motion";

const SURFACES = [
  {
    name: "Web",
    tag: "Next.js 16 · React 19 · TypeScript strict",
    modules: [
      "150+ dashboard pages",
      "All operator workflows (approval, council, agent bus, AI settings)",
      "Public /status + /trust + /how-it-works + /pricing",
    ],
  },
  {
    name: "Mobile (iOS + Android)",
    tag: "React Native or native Swift/Kotlin port",
    modules: [
      "Typed mobileApiClient — closed-union error kinds",
      "APNS + FCM push payload builder",
      "Offline-queue store with conflict detection",
      "axiom:// deep links + universal links",
      "Biometric re-auth + session security helpers",
    ],
  },
  {
    name: "Desktop (macOS + Windows + Linux)",
    tag: "Electron / Tauri / native shells",
    modules: [
      "OS detection + capability map (keychain, notifications, tray)",
      "Per-OS notifications: macOS UNNotificationContent / Windows Toast XML / Linux libnotify",
      "Cross-platform keychain abstraction",
      "Auto-updater manifest validator + decideUpdate",
      "Tray-icon state machine (ok/attention/critical/offline/needs_login)",
    ],
  },
];

export function PlatformsClient() {
  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        <div className="absolute top-0 right-0 h-[70vh] w-[55vw] rounded-full bg-gradient-to-br from-cyan-500/15 via-indigo-500/10 to-transparent blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-20 pb-12">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-cyan-300"
        >
          three surfaces · one contract
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]"
        >
          Where you work,{" "}
          <span className="bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            Axiom shows up.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[16px] text-zinc-400 leading-relaxed"
        >
          One source of truth, three operator surfaces. Each shell is built on the
          same closed-union TypeScript kernels — so a fix shipped on web reaches
          mobile and desktop the same week.
        </motion.p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SURFACES.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.07 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-cyan-500/30 hover:bg-white/[0.04] transition"
            >
              <p className="text-[12px] font-mono uppercase tracking-widest text-cyan-300">{s.name}</p>
              <p className="mt-2 text-[12.5px] text-zinc-500">{s.tag}</p>
              <ul className="mt-4 space-y-2">
                {s.modules.map((m) => (
                  <li key={m} className="text-[13px] text-zinc-300 leading-snug flex items-start gap-2">
                    <span className="text-cyan-300 mt-[2px]">·</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-16 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Three surfaces. One safety contract.
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          approval-only-no-execution. closed-union types. sha-256 rationale rows. The
          rules don't bend per surface.
        </p>
      </section>
    </div>
  );
}
