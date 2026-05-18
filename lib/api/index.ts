/**
 * Canonical API safety helper barrel.
 *
 * Routes import from `@/lib/api` and get a single coherent module
 * surface: typed envelopes, source mode, safety contracts, redaction,
 * and correlation id helpers.
 */

export * from "./apiEnvelope";
export * from "./correlation";
export * from "./redaction";
export * from "./safetyContracts";
export * from "./sourceMode";

// Re-export the legacy envelope shape for routes that haven't migrated yet.
export {
  apiSuccess,
  apiFailure,
  toErrorDTO,
} from "./dtoMappers";
export type {
  ApiSuccess,
  ApiFailure,
  ApiResponse,
  ErrorDTO,
} from "./dtoMappers";
