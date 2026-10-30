# Fixture-selected foreground activation implementation plan

Goal: complete the approved disposable TextEdit handoff without relaxing foreground validation.
Architecture: native-only fixture capability, disclosed by final native confirmation; exact selected PID/window raised before the existing fresh Rust attestation and single claim. Normal documents retain manual handoff.
Tech stack: Swift AppKit/Accessibility, Tauri, React.
Spec: docs/recovery/2026-10-29/bot-explicit-selected-window-activation-blueprint.md
Execution: inline under executing-plans, as requested by the user's instruction to finish without routine checkpoints.
Global constraints: local only; no deadline extension, new permissions, background input, automatic retry, provider writes or deployment.
Review focus: missing consent; non-fixture text; expired deadline; changed identity; unrelated foreground application.

## Task 1: native policy and implementation
Files: AxiomWindowInput.swift and AxiomWindowInputPolicyTests.swift under desktop/src-tauri/native.
Interface: inputFixtureActivationAllows(before:after:fixtureConsent:exactConsent:current:deadline:now:) -> Bool.
- Add failing tests for exact fixture and every negative gate, including non-finite time.
- Implement pure policy, bind fixture consent to the selected target, disclose activation in final confirmation, and activate only the bound signed process/raise only bound AX window after confirmation. Revalidate before and after activation; retain existing handoff, fresh attestation and claim.
- Run Swift policy executable; all assertions must pass.

## Task 2: copy, verification and review
Files: BotComputerInputPanel.tsx and focused frontend test if required.
- Make confirming text defer to the exact native prompt, describing fixture activation and normal manual handoff honestly.
- Run focused input tests, frontend types/build and embedded native build; sign and strictly verify the local app.
- Obtain final independent code review. Record local results separately from live acceptance. Commit only source/docs; preserve user sessions and original histories.
