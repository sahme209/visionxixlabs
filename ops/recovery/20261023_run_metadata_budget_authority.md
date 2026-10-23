# Run metadata cannot expand spending authority

The authenticated workforce start route accepts arbitrary run metadata from an actor allowed to apply actions. Previously `resolveRunBudgetCap` treated `unlimitedBudget: true` and larger `maxCostCents` metadata as more authoritative than saved administrator limits. The separate budget configuration endpoint requires an administrator, so start metadata was crossing that policy boundary.

The resolver now first selects the saved per-pipeline limit, workspace default, or finite platform default. A numeric request cap can only tighten that allowance. Caller-supplied unlimited flags cannot waive it. Saved administrator unlimited settings remain supported. Existing metadata-dependent raises are intentionally restricted; administrators must use the existing budget configuration path. No policy rows, balances, roles, provider calls or cockpit design changed.

Verification: four pure regression cases failed against the previous resolver. Two actual pipeline-runner fixture cases also failed against the previous resolver: an already-spent 100-cent saved cap dispatched a stage when metadata requested unlimited or 99,999 cents. The fixed resolver refuses both before the executor, records the saved cap source, and still respects a tighter request cap. Focused resolver, runner and telemetry tests pass. Full clean-source validation is recorded separately before release.

This is an authority fix, not a projected-cost reservation or concurrent spending ceiling. The legacy pipeline still checks already-recorded cumulative stage costs. Pending, uncertain and concurrent stage/provider costs require separate enforcement; no stronger financial guarantee is claimed.
