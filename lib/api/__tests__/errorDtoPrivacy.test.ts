import { expect, it } from "vitest";
import { apiFailure, toErrorDTO } from "../dtoMappers";
import { apiErr } from "../apiEnvelope";
import { AxiomError, AxiomErrors } from "@/lib/errors/axiomErrors";

it("omits internal diagnostics from the DTO while retaining the original error", () => {
  const cause = new Error("SYNTHETIC_PRIVATE_CAUSE");
  const error = AxiomErrors.internal("internal.synthetic", "SYNTHETIC_PRIVATE_DETAIL", cause, { diagnostic: "SYNTHETIC_PRIVATE_CONTEXT" });
  const dto = toErrorDTO(error);
  expect(dto).toEqual({ code: "internal.synthetic", category: "internal", userMessage: "Something went wrong. The team has been notified." });
  expect(dto).not.toHaveProperty("detail");
  expect(dto).not.toHaveProperty("context");
  expect(error.detail).toBe("SYNTHETIC_PRIVATE_DETAIL");
  expect(error.context).toEqual({ diagnostic: "SYNTHETIC_PRIVATE_CONTEXT" });
  expect(error.cause).toBe(cause);
});

it("preserves typed noninternal validation detail and defined context", () => {
  const error = new AxiomError({ code: "input.invalid", category: "validation", userMessage: "Check the input.", detail: "Field must be positive.", context: { field: "count", minimum: 1, absent: undefined } });
  expect(apiFailure(error)).toEqual({ ok: false, error: { code: "input.invalid", category: "validation", userMessage: "Check the input.", detail: "Field must be positive.", context: { field: "count", minimum: 1 } } });
});

it("omits internal diagnostics from the shared API error envelope", async () => {
  const error = AxiomErrors.internal("internal.synthetic", "SYNTHETIC_PRIVATE_DETAIL", undefined, { diagnostic: "SYNTHETIC_PRIVATE_CONTEXT" });
  const response = apiErr(error, { correlationId: "synthetic-correlation" });
  const body = await response.json();
  expect(response.status).toBe(500);
  expect(response.headers.get("x-correlation-id")).toBe("synthetic-correlation");
  expect(body.error).toEqual({ code: "internal.synthetic", category: "internal", userMessage: "Something went wrong. The team has been notified." });
  expect(JSON.stringify(body)).not.toContain("SYNTHETIC_PRIVATE");
});
