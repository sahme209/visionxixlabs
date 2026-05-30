import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function LearningPage() {
  return (
    <HonestEmptyPage
      kicker="learning"
      title="What the agents are learning."
      description="Agent learning records — corrections, calibration deltas, decision rationales the platform applied across runs — surface here. No seeded learning records by design."
      needs={[
        "LearningEvent rows tied to AxiomAgentRun decisions",
        "Calibration deltas vs the prior week",
        "Per-engineer reflection notes when the loop self-corrects",
      ]}
    />
  );
}
