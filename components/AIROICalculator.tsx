"use client";

import { useState } from "react";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export function AIROICalculator() {
  const [ticketsPerMonth, setTicketsPerMonth] = useState(500);
  const [costPerTicket, setCostPerTicket] = useState(12);
  const [automationRate, setAutomationRate] = useState(70);

  const monthlyCostBefore = ticketsPerMonth * costPerTicket;
  const ticketsHandledByAI = Math.round(ticketsPerMonth * (automationRate / 100));
  const ticketsHumanHandles = ticketsPerMonth - ticketsHandledByAI;
  const monthlyCostAfter = ticketsHumanHandles * costPerTicket;
  const monthlySavings = monthlyCostBefore - monthlyCostAfter;
  const annualSavings = monthlySavings * 12;

  return (
    <section id="roi" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="h-6 w-6 text-indigo-600" />
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">AI support ROI calculator</h2>
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-2xl">
          Estimate your savings when Vision XIX AI handles routine support. Adjust the sliders to match your team.
        </p>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-lg">
          <div className="space-y-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Support tickets per month
              </label>
              <input
                type="range"
                min={100}
                max={5000}
                step={50}
                value={ticketsPerMonth}
                onChange={(e) => setTicketsPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-sm text-slate-500 mt-1">{ticketsPerMonth.toLocaleString()} tickets</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Cost per ticket (human-handled)
              </label>
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={costPerTicket}
                onChange={(e) => setCostPerTicket(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-sm text-slate-500 mt-1">${costPerTicket}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                AI automation rate (%)
              </label>
              <input
                type="range"
                min={30}
                max={90}
                step={5}
                value={automationRate}
                onChange={(e) => setAutomationRate(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-sm text-slate-500 mt-1">{automationRate}%</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Monthly savings</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${monthlySavings.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Annual savings</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${annualSavings.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Based on {ticketsHandledByAI} tickets handled by AI and {ticketsHumanHandles} by humans. Results will vary.
          </p>
          <Link href="/visionxix-ai-assistant" className="mt-6 inline-flex items-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Try Vision XIX AI
          </Link>
        </div>
      </div>
    </section>
  );
}
