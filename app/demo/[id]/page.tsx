/**
 * /demo/[id] — Phase 405 per-scenario visual walkthrough.
 *
 * Server shell: validates the scenario id against the closed-union and
 * hands off to <DemoScenarioClient/> which owns the interactive state
 * (active step, keyboard nav, visual stage rebuilds). Keeping the page
 * itself a Server Component means the scenario data + doc cross-refs
 * render statically, and only the walkthrough chrome hydrates.
 */

import { notFound } from "next/navigation";
import { getScenario, isDemoScenarioId } from "@/lib/demo/demoScenarios";
import { DemoScenarioClient } from "./DemoScenarioClient";

export const dynamic = "force-dynamic";

export default async function DemoScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDemoScenarioId(id)) {
    notFound();
  }
  // Narrowing predicate makes id safe to cast.
  const scenario = getScenario(id as Parameters<typeof getScenario>[0]);

  return <DemoScenarioClient scenario={scenario} />;
}
