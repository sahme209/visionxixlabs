/**
 * Canonical Axiom domain contracts.
 *
 * Re-export hub for the typed primitives every other library and surface
 * should depend on. Avoid declaring overlapping unions in feature modules —
 * extend or import from here instead.
 */

export * from "./ids";
export * from "./source";
export * from "./provider";
export * from "./status";
export * from "./tenancy";
