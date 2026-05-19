/**
 * Vitest stub for the `server-only` package.
 *
 * The real package throws at import-time when bundled for the
 * client. Inside Node-based tests it has no purpose, so we replace
 * it with an empty module that just satisfies the resolver.
 */
export {};
