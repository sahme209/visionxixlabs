"use client";

import {
  CloudIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

type Service = {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  items: string[];
  outcomes: string[];
};

export function ServicesGrid({ services }: { services: Service[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {services.map((service, idx) => {
        const Icon = service.icon;
        return (
          <Reveal key={service.id} direction="up" delay={idx * 0.06}>
            <HoverCard className="p-8 flex flex-col h-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl">
              <div className="flex items-start gap-4 mb-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {service.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-400 flex-1">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    What we deliver
                  </p>
                  <ul className="space-y-1">
                    {service.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Outcomes
                  </p>
                  <ul className="space-y-1">
                    {service.outcomes.map((outcome) => (
                      <li key={outcome} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </HoverCard>
          </Reveal>
        );
      })}
    </div>
  );
}
