# Observed endpoint snapshot versus quote qualification

Read-only independent review of the saved response and actual local quote source found these gaps, with no further reads or execution:

- codingRequestQuote.ts currently accepts only synthetic integer nano-dollar evidence. The endpoint response uses decimal rates and regional overrides; it is not a trusted constructor input.
- Exact upstream selection is insufficient to select a region. Existing envelope region=default does not qualify every listed geographic price.
- Nonzero web_search and input_cache_write dimensions conflict with the first contract's zero-ancillary-fee requirement. No feature-specific applicability exception has been approved. Do not ignore a field to pass qualification.
- tokenizer=null does not qualify a conservative total-input estimator. Capacity and supports_max_tokens do not prove enforced total output/billable overhead.
- Local fetch time is not a provider price guarantee. Status, ZDR and training metadata are observations, not independent operational/security qualification.

A future observed-endpoint adapter needs concrete decimal/unit/region/fee semantics review and tests using this preserved snapshot, never a refetch by default. Treating nonzero feature fees as inapplicable would change the reviewed first contract and requires validation-first review. Estimator/total-output qualification remains separate. Canonical quote eligibility stays unavailable; no model or production mode change.
