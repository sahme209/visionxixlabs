"use client";

import { UserGroupIcon } from "@heroicons/react/24/outline";

type ClientCollaborationSectionProps = {
  title?: string;
  items: string[];
};

export function ClientCollaborationSection({
  title = "Client collaboration model",
  items,
}: ClientCollaborationSectionProps) {
  return (
    <section className="mb-16" aria-labelledby="client-collab-heading">
      <div className="mb-6">
        <h2 id="client-collab-heading" className="text-2xl md:text-3xl font-bold text-white mb-2">
          {title}
        </h2>
        <p className="text-zinc-400 max-w-3xl">
          We work alongside your team and integrate with your existing processes.
        </p>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"
            aria-hidden
          >
            <UserGroupIcon className="h-5 w-5" />
          </span>
          <ul className="grid gap-3 sm:grid-cols-2 text-zinc-300">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
