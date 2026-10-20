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

## Follow-up: interception ordering regression

The later retained capture at integrated source
`35d1592b2c8c54b200f9a1ce3009314c74ee9e1a` identifies
`timedOutOperation: cdp.Page.navigate`, again before a DOM wait or image.
Its retained Next development log contains font-denial retries but no finished
homepage request. Those server-relative timestamps are not an elapsed CDP
navigation clock. The 14.3-second completed GET above belongs to the earlier
window; it must not be attributed to this later attempt. Supervisor loss and
subsequent exact-group recovery are separate cleanup evidence, not success.

The new test-only regression extracts the **actual driver event callback** and
uses the **actual channel** with synthetic in-process socket messages. It
demonstrates synchronous and queued request-paused events during pending
navigation, continuation acknowledgement before navigation acknowledgement,
continued refusal of external/API requests, and cancellation of navigation when
either interception command fails. A continued main request can still reach the
existing navigation timeout. There is no inherent JavaScript command-serialization
deadlock in the represented order; this is not live-browser protocol proof.

All existing bounds remain unchanged:

- CDP commands and WebSocket opening: 15 seconds per operation.
- HTTP target enumeration: 2 seconds.
- Initial DOM readiness: 45 seconds, starting **after** navigation responds.
- Absolute driver session: 120 seconds, including config and transport setup.
- Parent capture wait: 125 seconds; overall coordinator: 300 seconds.

No navigation-budget, warmup, proxy-header, request-policy, permission or runtime
change is justified by these regressions alone. A separately reviewed warmup
experiment must retain the same ownership, allowlist, cancellation and absolute
limits; it is not a proven correction. Rendered acceptance remains outstanding.
The affected interception/operation diagnostic tests passed 17 cases across two
files without a server, browser, network request or production interaction.
