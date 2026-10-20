# Website operation timeout diagnostics — October 20, 2026

## Observed local failure

The freshly reviewed local window at integrated source
`786a990a9db179714b69ff415f6a79b5f33cb156` returned
`website_driver_operation_timeout`. Its capture receipt has `preImageWait: null`,
zero images and no completed acceptance evidence. The server logged use of the
owned tsconfig and a homepage GET returning 200 after 14.3 seconds, including
13.8 seconds of Next work. External Google font downloads were denied and fell
back. This is not a successful rendered acceptance run.

The driver registers the initial DOM wait **after awaiting `Page.navigate`**.
Navigation's existing 15-second CDP operation timeout is a plausible explanation,
but the old receipt cannot distinguish it from concurrently timed-out intercepted
request commands or another earlier operation. A completed server request does
not prove delivery, hydration, animation readiness or a screenshot. No further
browser/server attempt is authorized by this source diagnostic proposal.

## Diagnostic-only correction

The existing session records the first operation whose own timer expires, using
only a closed label: a known fixed CDP method, HTTP target enumeration, WebSocket
opening, sleep, or `unclassified`. The capture receipt includes that nullable
`timedOutOperation` value. Unknown names, endpoints, parameters, request IDs,
page content and raw error text are not retained by the new diagnostic.

Successful commands, socket closure and the absolute driver deadline do not
become operation-timeout evidence. The first recorded label is not replaced by
later concurrent timeouts. The diagnostic vocabulary does not authorize or
filter commands. Existing operation timeouts, absolute lifetime, readiness
predicates, browser commands, cancellation and network/process guards are
unchanged. No retry, extra CDP request, new wait or larger deadline is introduced.

Both changed executable files already belong to the reviewed source manifest.
Their new bytes require a fresh exact-source review before any future runtime
window; an old manifest is not execution approval for this change.

## Cleanup assessment

The runtime retained its artifacts because cleanup encountered an unreadable
`/proc/<pid>/exe`. The stored error does not preserve the descendant's state at
that instant, so it cannot establish whether this was an exit race or a live
member whose identity was unavailable. The existing inventory accepts confirmed
disappearance or a same-identity zombie transition, but otherwise fails closed.
Subsequent independent root inspection reported all four exact owned groups
empty. That later observation does not retroactively establish failure-time
absence or convert the original cleanup result into success.

Cleanup executable code is unchanged. Added regressions explicitly preserve the
confirmed-zombie case and continued refusal for an unreadable relevant member
without confirmed disappearance/zombie state. No signalling, artifact removal
or general ENOENT suppression is part of this patch.

## Verification limits

New operation-diagnostic tests failed against the former session, then passed
with the new diagnostic. Focused tests exercise the unchanged 15-second bound,
concurrent first-timeout retention, successful command and cancellation cases,
the distinct absolute deadline, WebSocket opening, closed-label containment and
the actual driver's pure final-receipt construction. The run uses synthetic
in-process sockets and fake clocks, not a browser or network endpoint.
The final focused run passed 71 tests across four files; scoped ESLint, both
executable syntax checks and the diff whitespace check passed. Vite's existing
native-config-loader compatibility warning remained visible.

No full compiler, server/browser run, production request, deployment, package
installation or cleanup of the retained failed-window artifacts was performed.
