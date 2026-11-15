# Manual-story CI migration review plan

2026-11-15. Read-only diagnosis/design review; no test, build, browser, source or security-pin modification performed. The failed PR336 job preserves a meaningful refusal: #product-tour exists but the removed Play control does not. Migrate the fixture to current deliberate manual behavior rather than reintroducing a player or skipping interaction qualification.

## Required replacement interaction contract

1. Replace homepage_playback readiness with a bounded homepage_manual phase. Check document/tour, expected story/step group, enabled first-step control and no player controls. Actual subsequent React state changes must be awaited; SSR control presence alone does not prove hydration.
2. Directly select Workspace step2; require its exact title/code, aria-current=step and step-status advancement. Compare state across a bounded idle interval to prove no automatic advancement. Scroll offscreen and background the document; preserve the same selected state/code, labeling these manual-state retention checks rather than timer/pause proof.
3. Select the sample review step, approve and reject; assert the explicit sample messages. Select another step and assert the sample decision clears. Select a different story and assert reset to step1/no sample decision; choosing the current story also resets under the actual source contract.
4. Retain the native keyboard branch-selector interaction. Require changed branch, reset to step1 and cleared sample decision. Context values survive story changes; actual context changes clear decision/reset step, while no provider operation occurs.
5. Focus a button INSIDE Story steps before dispatching ArrowLeft/ArrowRight/Home/End. Assert current step/status and clamping at both bounds. Arrow keys dispatched while focus is left on a sample-decision button outside that group do not test the real handler.
6. Retain Agent sample decision and Terraform held/disabled-apply checks with current direct step controls. Remove Replay/Next/Play/Pause click assumptions entirely; do not merely hide their missing-control failures.
7. At360px use a direct step button and require no horizontal overflow. Reduced-motion uses the same manual controls and stable state; assert no player instead of expecting a disabled Play button.
8. Retain essential-only consent, settled trusted-pointer geometry, single trusted clicks, six existing screenshot output identities and actual documentation navigation probe/destination. Do not replace trusted pointer clicks with DOM click/dispatch or forced router navigation to make the fixture green.

## Sanitized diagnostics and tests

Update capture-owned-website.mjs and owned-website-ci.mjs together: readiness phases, bounded DOM snapshot fields, homeCapturePhase, control/interaction tokens and completed-evidence allowlists. Reject unknowns as before; never accept arbitrary labels/URLs/HTML/code/credentials in public diagnostics. Rename timer/player evidence so new reports cannot masquerade as old behavior. Test invalid phases/fields, missing/disabled manual controls, bounded state/current-step values and unknown-token redaction. Update the existing ownedWebsiteCi/diagnostic expectation fixtures with meaningful new assertions; preserve unrelated security/driver tests.

The actual driver should fail if a direct step does not change state, a sample decision survives a specified reset, a removed player returns, Terraform apply appears, context keyboard handling fails, geometry is obscured, navigation is not genuine or cleanup is uncertain. Positive source/component tests complement rather than replace the isolated built-browser run.

## Pins and unchanged boundaries

Review the exact diff and regenerate the ordinary CI review manifest for the new PR head using the established preparation mechanism. Do not blindly repin native/runtime/compiler/security packages, disable required jobs, widen request/network/authority policy or weaken process ownership/deadlines/cleanup. Keep browser driver selection, session/debug-channel guards, fetch admission, source/tool identities, output membership and owned-group EMPTY proof unchanged. The old failed job remains historical. Same PR requires fresh green exact-head checks before normal merge; no deployment follows from this fixture correction alone.
