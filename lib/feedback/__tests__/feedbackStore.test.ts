/**
 * Vitest unit test for the feedback sentiment validator.
 *
 * The full captureFeedback function writes to Prisma + the outbound
 * lane, so its end-to-end behavior is covered by integration. Here
 * we lock in the boundary classifier so invalid sentiments can't
 * silently slip into the DB.
 */

import { describe, it, expect } from "vitest";
import { isFeedbackSentiment } from "../feedbackStore";

describe("feedback sentiment validator", () => {
  it("accepts the three known sentiments", () => {
    expect(isFeedbackSentiment("happy")).toBe(true);
    expect(isFeedbackSentiment("neutral")).toBe(true);
    expect(isFeedbackSentiment("frustrated")).toBe(true);
  });

  it("rejects unknown sentiments", () => {
    expect(isFeedbackSentiment("angry")).toBe(false);
    expect(isFeedbackSentiment("")).toBe(false);
    expect(isFeedbackSentiment("HAPPY")).toBe(false); // case-sensitive on purpose
  });
});
