import { describe, expect, it } from "vitest";
import {
  projectChecklist,
  buildOnboardingChecklistResponse,
  type OnboardingChecklistRepo,
} from "../onboardingChecklistResponder";

interface Stub extends OnboardingChecklistRepo {
  _counts: { installationCount: number; applicationCount: number; repositoryCount: number; releaseCount: number };
}

function makeRepo(): Stub {
  const stub: Stub = {
    _counts: { installationCount: 0, applicationCount: 0, repositoryCount: 0, releaseCount: 0 },
    gitHubInstallation: { async count() { return stub._counts.installationCount; } },
    application: { async count() { return stub._counts.applicationCount; } },
    repository: { async count() { return stub._counts.repositoryCount; } },
    release: { async count() { return stub._counts.releaseCount; } },
  };
  return stub;
}

describe("projectChecklist", () => {
  it("empty state — 0% complete, all blocked except first", () => {
    const p = projectChecklist({ installationCount: 0, applicationCount: 0, repositoryCount: 0, releaseCount: 0 });
    expect(p.percent).toBe(0);
    expect(p.completed).toBe(0);
    expect(p.items[0].blockedByPredecessor).toBe(false);
    expect(p.items[1].blockedByPredecessor).toBe(true);
    expect(p.items[2].blockedByPredecessor).toBe(true);
    expect(p.items[3].blockedByPredecessor).toBe(true);
    expect(p.nextItem?.key).toBe("install_github_app");
    expect(p.allDone).toBe(false);
  });

  it("install done — 25% complete, app step unblocked", () => {
    const p = projectChecklist({ installationCount: 1, applicationCount: 0, repositoryCount: 0, releaseCount: 0 });
    expect(p.percent).toBe(25);
    expect(p.items[0].done).toBe(true);
    expect(p.items[1].blockedByPredecessor).toBe(false);
    expect(p.nextItem?.key).toBe("register_application");
  });

  it("3 of 4 done — 75% complete", () => {
    const p = projectChecklist({ installationCount: 1, applicationCount: 2, repositoryCount: 3, releaseCount: 0 });
    expect(p.percent).toBe(75);
    expect(p.nextItem?.key).toBe("create_release");
    expect(p.allDone).toBe(false);
  });

  it("all done — 100%, nextItem null, allDone true", () => {
    const p = projectChecklist({ installationCount: 1, applicationCount: 1, repositoryCount: 1, releaseCount: 1 });
    expect(p.percent).toBe(100);
    expect(p.completed).toBe(4);
    expect(p.allDone).toBe(true);
    expect(p.nextItem).toBeNull();
  });

  it("install CTA opens the internal handoff page", () => {
    const p = projectChecklist({ installationCount: 0, applicationCount: 0, repositoryCount: 0, releaseCount: 0 });
    expect(p.items[0].cta.href).toBe("/dashboard/github-app");
  });

  it("done items update CTA label to 'Manage'", () => {
    const p = projectChecklist({ installationCount: 1, applicationCount: 1, repositoryCount: 1, releaseCount: 1 });
    expect(p.items[0].cta.label).toBe("Manage install");
    expect(p.items[1].cta.label).toBe("Manage applications");
    expect(p.items[3].cta.label).toBe("View releases");
  });
});

describe("buildOnboardingChecklistResponse", () => {
  it("200 empty when no records", async () => {
    const stub = makeRepo();
    const r = await buildOnboardingChecklistResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.checklist.completed).toBe(0);
  });

  it("200 sums counts from all 4 resources", async () => {
    const stub = makeRepo();
    stub._counts = { installationCount: 1, applicationCount: 1, repositoryCount: 2, releaseCount: 0 };
    const r = await buildOnboardingChecklistResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.checklist.completed).toBe(3);
    expect(r.body.data.checklist.nextItem?.key).toBe("create_release");
  });

  it("200 degrades to count=0 when a single table is missing", async () => {
    const stub = makeRepo();
    stub.gitHubInstallation.count = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    stub._counts.applicationCount = 1;
    stub._counts.repositoryCount = 1;
    const r = await buildOnboardingChecklistResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    // installationCount degraded to 0, others present
    expect(r.body.data.checklist.items[0].done).toBe(false);
    expect(r.body.data.checklist.items[1].done).toBe(true);
    expect(r.body.data.checklist.items[2].done).toBe(true);
  });
});
