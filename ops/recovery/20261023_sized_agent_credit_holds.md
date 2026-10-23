# Sized small-Agent reservations

## Actual production finding

The separately authorized read-only README acceptance used one Claude Sonnet 5 call (2,589 input and 107 output tokens) and observed `sahme209/axiom-releases/main/README.md` (1,717 bytes). The summary step was refused: the first pending $1 hold left $0.94 available from the pre-test $1.94 allowance. No second model request or retry was dispatched. Original Agent tools were restored. Ordinary reconciliation settled a two-cent customer debit, cleared the hold, and left $1.92. This is repository-read acceptance, not a completed Code Review summary.

## Change

The existing exact-model, enrolled-public-Free-only policy now rounds the complete redacted prompt and system schema up to an 8, 16 or 32 KiB bucket. It prices the full bucket at four estimated tokens per byte plus 8,192 overhead tokens, the unchanged 4,096 output-token limit, maximum observed regional/cache input prices, output prices, platform margin and the existing 1.5 buffer. Each durable hold is the full resulting estimate; it is never clipped to balance. Unsupported or over-100-cent estimates fall back to ordinary policy. Receipt policy is `small_sonnet_free_v2`; old holds and receipts are unchanged.

The immutable quote digest still binds the actual full payload, schema, model and output bound, actor, tenant and correlation. Every step requires its own current quote, durable reservation, dispatch claim and accounted usage. Existing explicit service hold overrides, paid and isolated billing, routing restrictions, thinking-disabled setting, cancellation and revocation remain enforced. No ledger rewrite, top-up, model/tool grant or production SQL is involved.

This remains a conservative estimate under the existing platform-overrun policy, not a guaranteed provider-cost ceiling. Long prompts, pricing changes or actual insufficient balance may still be refused. No automatic retry or additional live acceptance is authorized.

## Validation

Three new sized-hold regressions failed against fixed holds before the change; all four bucket cases now pass. Forty-six focused quote/admission/installed-SDK checks pass. The isolated SQL suite passes 19 cases, including five full 36-cent synthetic-price holds and refusal of the next without clipping. Actual owned PostgreSQL passes all 104 cases with cleanup: streaming and buffered decision loops now complete another two-step task after prior settled usage, and each hold is checked against its immutable recorded quote evidence. Revocation and repair refusals remain covered. Model and cost transports are synthetic; this is not live post-fix Agent acceptance.
