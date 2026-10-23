# Small Free Agent reservation

The existing Free allowance is 200 cents but the general request hold is 1000 cents. The owner requested execution without further design checkpoints; this is an implementation choice within that task, not a new owner-specified financial policy.

Keep the general hold intact. Add a server-owned, opaque, payload-bound small-request policy for the already-approved exact `anthropic/claude-sonnet-5` model, available only to authoritative public Free enrollment inside the same serializable reservation transaction. Limit complete redacted prompt and schema/system to 32 KiB UTF8, output 4096, text only, Anthropic-only route with no fallback, thinking disabled, no server tools or explicit caching. Each iteration/repair still needs its own existing atomic hold and one-use dispatch claim. Generic text and other models stay unchanged.

Estimate four input tokens per permitted UTF8 byte plus 8192 wrapper tokens. Fetch current public endpoint prices without cache, including maximum applicable tiers, regional and cache-write premiums. Apply the existing billing margin and a further1.5 estimate buffer, with a 100-cent minimum hold. If the entire estimate exceeds 100 cents, metadata is unsupported, scope/expiry/payload/model changes, or eligibility is not proven, do not use this small path. Never clip an estimate to balance. An explicit deployment hold override retains precedence.

This is a conservative estimate, not a guaranteed provider-cost cap. The existing settlement policy already caps customer charges at the reserved amount and treats any provider overrun as platform cost. No new subsidy, credit grant, purchase or automatic retry is introduced. Preserve uncertainty holds. Reject missing usage/model/generation evidence. Record and inspect actual model usage before further paid acceptance.

Alternatives considered: lowering the global default (too broad); reserving the full model context (cannot fit Free); tokenizer estimates claimed as exact guarantees (unsupported); changing approved models (owner policy decision, unnecessary). The bounded existing-model path preserves current financial and governance boundaries while admitting a small real task. It does not complete generic Free generation or every model.

Server-owned estimate/bounds/quote-time/pricing-digest evidence is retained with usage, without prompt or schema content. Cancellation during metadata creates no hold; cancellation during reservation releases only a definitely unclaimed new hold. Other-model cancellation behavior is unchanged.
