/**
 * Registry and source-boundary checks complement WorkflowStories.test.ts,
 * which renders the component in jsdom for interaction regressions.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WORKFLOW_STORIES, scenarioFor } from "../workflowStories";

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("CinematicAxiomDemo — honesty contract", () => {
  const src = source("components/marketing/CinematicAxiomDemo.tsx");

  it("maps every story to an existing public scenario step", () => {
    for (const story of WORKFLOW_STORIES) {
      const scenario = scenarioFor(story);
      expect(scenario.audience).toBe("public");
      expect(scenario.steps.some(step => step.id === story.source.step)).toBe(true);
      expect(story.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("withholds Terraform actions and never claims cloud completion", () => {
    const story = WORKFLOW_STORIES.find(item => item.id === "cloud")!;
    expect(story.steps.every(step => !step.review)).toBe(true);
    expect(story.limitation).toContain("remain unavailable");
    const scenes = source("components/marketing/WorkflowStoryScene.tsx");
    expect(scenes).toContain("AWS ECS health not observed");
    expect(scenes).toContain("Terraform apply disabled");
    expect(scenes).not.toContain("Automatic rollback");
  });

  it("clearly discloses that the interactive experience is simulated", () => {
    expect(src).toContain("Interactive simulation");
    expect(src).toContain("Scripted sample data");
    expect(src).toContain("No cloud account, repository, AI credits, or deployment is touched.");
  });

  it("links to the complete safe demo collection", () => {
    expect(src).toContain('href="/demo"');
    expect(src).toContain("Explore every safe demo");
  });

  it("is actually wired into the homepage, not dead code", () => {
    const page = source("app/page.tsx");
    expect(page).toContain('import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";');
    expect(page).toContain("<CinematicAxiomDemo />");
  });
});
