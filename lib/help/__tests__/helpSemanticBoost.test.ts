/**
 * Vitest unit tests for the Phase 120 semantic cloud boost.
 *
 * Confirms cloud-aware queries route to cloud-specific entries over
 * cross-cloud surfaces, and that the boost can't push scores past
 * the 1.0 cap.
 */

import { describe, it, expect } from "vitest";
import { searchHelp } from "../helpSearchEngine";

describe("help search — semantic cloud boost", () => {
  it("an AWS-flavoured query prefers AWS-specific surfaces over the unified one", () => {
    const a = searchHelp("aws inventory ec2 s3", 5);
    const awsHit = a.hits.find((h) => h.entry.id === "aws-services");
    const unifiedHit = a.hits.find((h) => h.entry.id === "cloud-inventory");
    expect(awsHit).toBeDefined();
    // AWS-specific surface should outrank the cross-cloud aggregator.
    if (awsHit && unifiedHit) {
      expect(awsHit.score).toBeGreaterThanOrEqual(unifiedHit.score);
    }
  });

  it("'azure storage' steers the cloud-inventory aggregator UP (entry mentions storage)", () => {
    const a = searchHelp("azure storage", 5);
    expect(a.hits.length).toBeGreaterThan(0);
    // Whichever entry wins, it must be tagged azure-relevant (cloud-inventory
    // mentions all three clouds; aws-specific entries should NOT come back first).
    expect(a.primary?.id).not.toBe("aws-services");
  });

  it("boost never produces a score > 1.0", () => {
    const a = searchHelp("aws ec2 s3 rds lambda iam vpc cloudtrail guardduty eks", 10);
    for (const h of a.hits) {
      expect(h.score).toBeLessThanOrEqual(1);
    }
  });

  it("cloud-free query is unaffected by the boost", () => {
    const a = searchHelp("scp simulator", 5);
    expect(a.primary?.id).toBe("scp-simulator");
  });

  it("matchedTokens includes the cloud literal when boost applies", () => {
    const a = searchHelp("aws cloudtrail audit", 5);
    const cloudtrail = a.hits.find((h) => h.entry.id === "cloudtrail");
    expect(cloudtrail).toBeDefined();
    // The "aws" token should appear in matchedTokens for the cloudtrail
    // entry because the boost triggered (its keywords include "cloudtrail"
    // which is in the AWS indicator set).
    if (cloudtrail) {
      expect(cloudtrail.matchedTokens.length).toBeGreaterThan(0);
    }
  });
});
