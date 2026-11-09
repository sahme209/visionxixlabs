import { describe, expect, it } from "vitest";
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";
import { CONTROL_PLANE_LAYERS } from "../controlPlaneModel";
import { SECURITY_ASSESSMENT_STAGES } from "../securityAssessmentModel";
import { INTEGRATION_FLOW_STAGES } from "../integrationFlowModel";
import { DESKTOP_SETUP_STAGES } from "../desktopSetupFlowModel";
import { PERMISSIONS_FLOW_STAGES } from "../permissionsFlowModel";
import { APPROVAL_FLOW_STAGES } from "../approvalFlowModel";
import { PREPAID_FLOW_STAGES } from "../prepaidFlowModel";

/** Every page explanation built on PipeFlow must follow the same readable, honest shape. */
const FLOWS: Record<string, readonly PipeFlowStage[]> = {
  product: CONTROL_PLANE_LAYERS,
  security: SECURITY_ASSESSMENT_STAGES,
  integrations: INTEGRATION_FLOW_STAGES,
  download: DESKTOP_SETUP_STAGES,
  permissions: PERMISSIONS_FLOW_STAGES,
  approval: APPROVAL_FLOW_STAGES,
  prepaid: PREPAID_FLOW_STAGES,
};

describe.each(Object.entries(FLOWS))("pipe flow data: %s", (_name, stages) => {
  it("has 3–6 stages, each titled and explained, with 3 titled and explained parts", () => {
    expect(stages.length).toBeGreaterThanOrEqual(3);
    expect(stages.length).toBeLessThanOrEqual(6);
    for (const s of stages) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.title.length).toBeLessThanOrEqual(24);
      expect(s.summary.length).toBeGreaterThan(0);
      expect(s.parts).toHaveLength(3);
      for (const p of s.parts) { expect(p.title.length).toBeGreaterThan(0); expect(p.title.length).toBeLessThanOrEqual(24); expect(p.detail.length).toBeGreaterThan(0); }
      expect(s.guarantee.length).toBeGreaterThan(0);
      expect(s.onFailure.length).toBeGreaterThan(0);
    }
  });

  it("passes an explained packet between stages and ends with none", () => {
    stages.slice(0, -1).forEach((s) => { expect(s.passesOn?.label).toBeTruthy(); expect(s.passesOn?.detail).toBeTruthy(); });
    expect(stages[stages.length - 1].passesOn).toBeNull();
  });

  it("uses unique ids and one tone per stage", () => {
    expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length);
    expect(new Set(stages.map((s) => s.tone)).size).toBe(stages.length);
  });
});
