# Four approved fee-qualification documentation reads

Completed the separately approved public documentation investigation. Four official page destinations were opened, with relevant sections inspected on those same references. No linked fifth page, model metadata refetch, customer/code disclosure, credential, inference, implementation, deployment or spend. The read exception is consumed. These are current unversioned descriptions, not a pinned installed-SDK or billing-contract attestation.

## Source findings

1. **Gateway routing and caching.** Vercel distinguishes provider preference from an upstream allowlist: the latter refuses when its permitted providers cannot serve the request. It documents an explicit automatic-caching option. Session affinity is enabled by default and can retain provider/cache association. This supports reviewing exact route and cache options; it does not prove that Axiom's absent cache setting excludes every upstream cache charge, or bind account/virtual-model settings or regional prices. [Official routing/options page](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options).

2. **Pricing dimensions.** Anthropic separates ordinary input, output, cache creation and cache reading. Five-minute and one-hour cache writes have different rates. Geographic modifiers can affect all token categories; partner-platform prices are separate. Web search has an event charge as well as token costs. Consequently the saved endpoint's single cache-write rate is not automatically a bound for every cache lifetime. No rate is copied into production. The page gives public prices and usage descriptions, not a guaranteed quote-validity window or an immutable complete Gateway schema. [Official pricing page](https://platform.claude.com/docs/en/about-claude/pricing).

3. **Search applicability.** Anthropic's Messages interface enables search through a declared request tool, while its Managed Agents product enables search by default. Search can repeat within one request. These different product defaults make a generic “no search” assertion unsafe. This supports a future exact Messages-style exclusion investigation, but does not by itself qualify the installed Gateway SDK path or downstream/account behavior. No search or tool was invoked. [Official web-search page](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool).

4. **Input and total output.** Anthropic describes prompt content, system text and tool definitions as context inputs. Its input accounting separates uncached, cache-read and cache-creation categories. Thinking contributes to output accounting and the API output parameter. These statements improve the direct-provider semantic evidence; they do not supply Axiom's conservative input-token estimator, prove an exact SDK-to-upstream bound, or authorize an authenticated counting request. [Official context-window page](https://platform.claude.com/docs/en/build-with-claude/context-windows).

## Decision and next gates

- Keep the strict current fee contract and observational parser unchanged. Do not infer a zero search fee from absent local SDK fields, or ignore cache-write lifetime/region differences.
- The proposed conservative accounting direction has stronger factual grounding, but remains a **new unapproved contract**. Any cache coefficient needs qualified category/count/lifetime/tier semantics; any search exclusion needs exact transport/product evidence.
- Installed SDK serialization evidence remains local/offline, separately version-bound. The direct-provider documentation is complementary, not a replacement for that binding.
- Trusted pricing provenance/freshness/completeness, conservative exact-input estimation, all relevant billable/output semantics, paid variants, production schema and activation remain open. Public documentation does not mint an opaque quote, restore an old approval or authorize a paid probe.

The [proposal](../../../proposals/coding-text-only-fee-qualification.md) now needs these findings incorporated before any implementation decision. This research narrows uncertainty; it does not complete A7 or Governance.
