# Current signed desktop handoff

1. Outcome: open the verified signed current preview after the user confirms saved drafts and readiness to quit the prior preview.
2. Owner/dependencies: root; user answered ready to the explicit save-and-CmdQ request; standard ps/signal/open only, no browser/UI injection or new dependencies.
3. Baseline: source3c578b5c/runtime916; signed binary4189cf...matches retained manifest. Actual PID67657 still names exactd374preview after ready, likely still background; no separate reviewer process seen. Do not claim it exited from user intent alone.
4. Change/non-goals: after exactPID/path/UID validation, send one normal TERM only to that prior preview, wait at most5seconds, and refuse launch if it remains. Never KILL, bulk-process match or terminate reviewer. Then open only the current signed temporary app using LaunchServices once, and inspect actualprocesspath. No rebuild/sign/restartloop/publication.
5. Boundaries: user's saved-work readiness supersedes earlier unknown-draft hold for this handoff only. Existing same-identifier startup may read/migrate saved credentials through normal app code; no direct secret read/copy/clear/export, prompt approval, grant or changed namespace. App normalstatus/verification behavior is not authorization for provider mutation or AI action. Stop on OS prompts/refusal; no workarounds.
6. Acceptance: exact previous process gone; new current binaryprocesspath present after one open, local launch request exit recorded. This is process-launch evidence only; no unsupported screenshot/current-account/session success claim.
7. Proof: actualprocessandLaunchServices result, not nativevisual/session/AT/Gatekeeper/notarization/fullGov qualification.
8. Recovery: preserve oldbundle+unsigned/signedarchives and localsource; no user data removed. If launch fails, retain result and do not automatically retry or launch anotherbuild.
9. Spend/authority: existing explicit updated-app request plus current saved-work ready response; zero CI/deploy/newcredential/grant/AI/providerwrite. One normalclose and one open only.
10. Evidence/next: retain exactprocesscoordinates/result and updateboard. Ask only for the user's observedcurrentUI outcome if no supportedvisualtool exists; leave independentdecisions/provideractions untouched.

Actual handoff update: oldPID67657 exited during revalidation before any signal. NoTERM/KILL sent. Allsame-executable processes absent immediately before open. Exact signedbinaryhash matched; one LaunchServices open returned0 and actualcurrentbinaryPID80463/starttime observed. NativeUI/session not inspected.
