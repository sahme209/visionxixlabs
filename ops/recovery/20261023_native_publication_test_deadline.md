# Native publication integration test deadline

The exact-archive suite reproduced three signing/publication test failures at 5.33–5.68 seconds under contention. Each test runs actual bounded shell subprocesses, including synthetic-key signing and local mocked publication; the subprocess deadline is 20 seconds and compound cases can run two sequential subprocesses. Vitest's inherited five-second test limit was shorter than that intended integration work.

The affected integration describe block now has a 45-second test limit, covering the two bounded subprocesses. No signature, digest, exclusive-create, immutable-publication assertion or production workflow check was removed or relaxed. All 34 native release guard cases passed in the focused rerun. These tests use only synthetic temporary keys and a fixed local fake GitHub CLI; no release was published.
