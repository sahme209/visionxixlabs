import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demo/demoScenarios";

export type StoryScene = "context" | "editor" | "check" | "output" | "github" | "proposal" | "receipt" | "terraform" | "evidence" | "hold";
export interface StoryStep { title: string; caption: string; scene: StoryScene; review?: true }
export interface WorkflowStory {
  id: "workspace" | "agent" | "cloud";
  label: string;
  eyebrow: string;
  limitation: string;
  source: { scenario: DemoScenarioId; step: string };
  steps: readonly StoryStep[];
}

// Source mapping is maintained with docs/marketing/workflow-stories.md.
// These are scripted illustrations, never provider receipts or native captures.
export const WORKFLOW_STORIES: readonly WorkflowStory[] = [
  {
    id: "workspace", label: "Code & review", eyebrow: "A small change. A clear review.",
    limitation: "Implementation preview: repository editing and approved project checks. Native behavior is unverified; a general terminal and autonomous local Agent execution are not available.",
    source: { scenario: "devops_pipeline", step: "4" },
    steps: [
      { title: "Choose the working context.", caption: "Select a sample repository and working branch. Keep the target visible throughout the change.", scene: "context" },
      { title: "Make a small, reviewable edit.", caption: "The repository workspace brings a scoped file explorer, editor and explicit save together. This example changes a timeout without changing the retry ceiling.", scene: "editor" },
      { title: "Review the bounded check.", caption: "Project scripts need a human decision. Review the command and its limits before continuing this sample.", scene: "check", review: true },
      { title: "Read the check output.", caption: "A bounded output panel keeps the command and result together. The text here is scripted sample output, not a check running on your machine.", scene: "output" },
      { title: "Review before publishing.", caption: "Publishing the working branch and opening a GitHub pull request is a separate, explicit action. This walkthrough stops at review.", scene: "github", review: true },
    ],
  },
  {
    id: "agent", label: "Agent & approval", eyebrow: "Context first. Permission before change.",
    limitation: "Implementation preview: governed GitHub proposals. This sample uses no model or repository. Production sign-in and cloud end-to-end acceptance are unresolved.",
    source: { scenario: "devops_pipeline", step: "5" },
    steps: [
      { title: "Attach context to the request.", caption: "The Agent carries the selected repository, branch and environment into a governed conversation.", scene: "context" },
      { title: "Inspect the proposed change.", caption: "Engineer mode proposes a scoped GitHub change for review. A proposal is separate from permission to write.", scene: "proposal" },
      { title: "Decide on the exact action.", caption: "Review the target, change and recovery path. Try approving or rejecting the sample; neither choice changes a real system.", scene: "github", review: true },
      { title: "Keep the outcome honest.", caption: "A recorded decision is only one piece of evidence. Repository writes and cloud outcomes require their own observations.", scene: "receipt" },
    ],
  },
  {
    id: "cloud", label: "Terraform & cloud", eyebrow: "Know what is ready. See what is missing.",
    limitation: "Terraform configuration previews are separate from execution. The trusted customer plan producer, current target authority and apply approval remain unavailable.",
    source: { scenario: "cloud_operations", step: "4" },
    steps: [
      { title: "Start with a configuration preview.", caption: "Read an illustrative Terraform change as a proposal for manual review. A configuration draft is not a trusted saved plan.", scene: "terraform" },
      { title: "Inspect the evidence boundary.", caption: "The review surface separates stored artifact evidence from current authority. Local fixture evidence cannot verify a customer cloud account.", scene: "evidence" },
      { title: "Keep the release on hold.", caption: "Missing authority stays visible. There is no apply action here, and a workflow trigger would not prove service health or recovery.", scene: "hold" },
    ],
  },
];

export function scenarioFor(story: WorkflowStory) {
  return DEMO_SCENARIOS[story.source.scenario];
}
