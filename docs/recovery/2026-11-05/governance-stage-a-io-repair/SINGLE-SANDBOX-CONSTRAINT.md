# Documented nested-policy constraint — current packet unready

The fresh6fccbe8c/19286eaafd8b9288ed00a5415df07d5c3a2ac87fb0a25b4e55692dddd2b1f45c packet is unexecuted and UNREADY. Do not request or perform its real run. Preserve it unchanged. The I/O correction remains useful but does not fix repeated sandbox initialization.

Concrete evidence: local macOS SDK sandbox.h lines23–27 documents that a process already in a sandbox cannot apply another profile; the new profile is ignored and initialization returns an error. Historical independently preserved one-shot synthetic diagnostic in docs/recovery/2026-11-04/support-expanded-evaluation-failure/report.md and diagnostic/report.md observed nested sandbox-exec exiting71, zero bytes, with sandbox_apply Operation not permitted. No experiment was repeated for this finding.

Current source applies an outer sandbox to the fixed driver, then another to offline child, plus existing per-command Git/npm/Prisma/emitter policies. That composition therefore cannot be accepted. The consumed first attempt stopped with generic prelaunch evidence; its live exception is still unconfirmed and is not retroactively labelled a captured nested-policy denial.

Next design: one outer kernel policy and fixed source-owned contained tool composition inheriting that policy throughout. Preserve all network/original-input write denials, fresh-output checks, source/receipt/engine joins, time/log/one-attempt bounds and unknown preservation. Public legacy standalone APIs retain their original policy application. No environment skip flag, general caller-controlled bypass, new permission or claimed runtime authority. The changed composition needs design review and validation-first decision before implementation; no actual run is authorized.
