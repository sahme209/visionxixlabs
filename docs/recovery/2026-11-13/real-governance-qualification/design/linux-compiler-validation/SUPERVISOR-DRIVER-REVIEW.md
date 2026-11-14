# Follow-up disposition — corrected source CLEAR

Both original P2 findings below are closed by exact source inspection. No remaining important source finding in the reviewed supervisor/driver/workflow scope. Frozen complete packet bindings still need their separate review before the one approved PR invocation. No tests, children, compiler, native operation or network was run by this follow-up.

- SIGTERM now has an owned handler in supervise. It defers cancellation during the synchronous Popen ownership transfer, then takes the refusal/cleanup path immediately after child assignment; capture-time termination also cleans up. Original handlers are restored. Pipes returned before cancellation are closed even before selector registration. The driver installs a SIGTERM→SystemExit handler between phases and catches BaseException for failed receipts. Termination does not advance to another compiler phase.
- Original leader identity remains retained with WNOWAIT before the one destructive group signal. After leader wait, a bounded signal-zero group presence probe must observe ESRCH before cleanup_confirmed becomes true; surviving group, denied/unknown probe or deadline yields cleanup_unknown. There is no further destructive signal after leader identity is released. This closes the acknowledgement gap without claiming containment of a malicious new-session escape; the ephemeral CI boundary limitation remains.
- Inspected mocked regressions cover SIGTERM during capture and Popen handoff, original handler restoration, surviving group after leader exit and denied presence probe. The primary reports16supervisor tests and42combined focused tests PASS; these are existing reported results, not reruns here.

Reviewed SHA256 bindings for this corrected source:

| File | SHA256 |
| --- | --- |
| `scripts/governance_linux_compile_supervisor.py` | `c0a4300bd547bbcbd6e806ff373bbc6d32a5f54b6fccca0a609eed406c563868` |
| `scripts/tests/test_governance_linux_compile_supervisor.py` | `24b956056848cc04aaa7b418ae355a6a5b0f50dc51be091ebc75732fd07d9e13` |
| `scripts/governance_linux_compile.py` | `f790a4ee0028f1443a40cb36431d0c07189010c1bf9170a53443282624358bc9` |
| `scripts/tests/test_governance_linux_compile.py` | `e833a8e3bafe0f940909605fe0c26678ea5e6d892802f14f1437b20a7aedcbc9` |
| `.github/workflows/linux-time-compile.yml` | `f2f48cd164f47973fffd4b8fcf677cbe42113494b245e4b9945b9dcd003da17e` |

The following original review is retained unchanged as historical pre-correction evidence; its “remain” findings are superseded by this follow-up. It is not a current rejection or a native qualification claim.

---

# Independent supervisor / driver / workflow source review

Read-only inspection of `scripts/governance_linux_compile_supervisor.py`, its mocked tests, `scripts/governance_linux_compile.py`, driver tests and `.github/workflows/linux-time-compile.yml`. No child, compiler, tests, native call, network or linked output was launched. The materializer was authored by this reviewer and is not independently approved by this review. Verdict: **two important owned-cleanup issues remain before the single CI invocation**. The driver’s frozen INPUT-PACKET.json was not yet present during this inspection; exact final input-binding review remains pending.

## Important findings

### P2 — SIGTERM bypasses owned cleanup

Supervisor lines48–50 create the child in a new session. Lines80–94 contain the only group kill/reap, inside Python finally. Neither supervisor nor driver installs a SIGTERM handler. POSIX default SIGTERM terminates Python without raising a catchable Python exception or running finally. Therefore cancellation/termination delivered to the Python driver while Cargo/rustc is running can exit before killing its detached original child group, before confirming cleanup, and before the final driver receipt. The workflow45-minute limit/ephemeral job cleanup is a separate outer boundary, not this implementation's promised five-second owned cleanup.

Resolve with explicit source-owned cancellation handling around the supervised lifetime (and restored handlers), routing cancellation into the same bounded group cleanup/refusal, with a mocked SIGTERM regression. Do not turn cancellation into success, silently start another compiler phase or rely on an eventual host teardown as confirmed cleanup. The existing SIGINT/KeyboardInterrupt catch path does not cover default SIGTERM.

### P2 — leader reap alone is reported as group cleanup confirmation

Supervisor lines84–91 send SIGKILL to the original process group, wait only for its retained leader, then unconditionally set cleanup_confirmed=true. A successful killpg reports signal delivery; it does not prove all descendants have exited. For example a leader may already have exited and closed its streams while an original-group descendant remains blocked in the kernel; reaping that leader does not establish that descendant's termination within five seconds. The header claims original-group coverage, and driver lines133–139 permit later phases based on cleanup_confirmed, so this is an incorrect acknowledgement boundary.

Retain the existing WNOWAIT protection against signaling a recycled group, but require bounded confirmation of disappearance of the original group before claiming cleanup. If that cannot be established, return cleanup_unknown, stop the whole bundle, retain the evidence and do not retry. A non-destructive presence check after owned signaling may conservatively refuse on uncertainty; do not send further destructive signals after losing original identity. Add a mocked leader-reaped/group-still-present case. This does not expand the promise to malicious processes escaping the original group; the ephemeral CI boundary limitation remains explicit.

## Reviewed behavior that is coherent

- Workflow is one opened-PR event on the exact same-repository branch and run_attempt1, Ubuntu24.04, contents-read only, checkout of the event head with persisted credentials disabled; no manual/synchronize/reopened retry path, deployment or artifact upload. Driver independently verifies event/public-repository/head/checkout coordinates.
- Workflow budget45minutes; driver total budget2400seconds is stricter for its supervised phases. Each child gets the remaining deadline minus cleanup allowance; per-child output is capped at16MiB across separate actual stdout/stderr logs, exclusive/nofollow mode0600. Child environment is explicitly supplied, no shell, stdin disabled, inherited FDs closed. Actual diagnostics are retained/printed; refusal stops the bundle rather than advancing.
- Actual nonprivileged unshare user/network namespace preflight occurs BEFORE locked fetch. No sudo, host-setting mutation or fallback follows a failed preflight. Fetch has locked inputs, explicit no-retry environment; offline metadata/build/link inspections subsequently use isolated commands. These are compile-checkpoint controls, not native runtime/process qualification.
- Only installed tools are selected; no rustup installation/update fallback. Source/lock hashes are checked around dependency/build stages, actual daemon feature selection is required, and C is compiled/archived before the actual Rust staticlib and whole-library nonrunning link. Native library arguments are closed tokens, no shell interpolation.
- `link_only` and daemon are never invoked. `nm`/`readelf` inspect the linked file; expected C and actual Rust path definitions plus target ELF checks are required. The receipt does not claim clock, source, host, accepted-policy, custody or Governance qualification.
- Existing pure tests cover separate diagnostics, partial writes, cap/equality, nonzero/timeout, failed spawn, input validation and leader wait failure, but do not currently establish the two cancellation/group-confirmation cases above. Source inspection is not a test result or native cleanup proof.

## Final acceptance still needed

Review the corrected source/mock regressions and frozen complete packet before the one owner-approved CI checkpoint. Preserve original failures and exact no-retry limits. Any real compiler/link failure stops that invocation and remains a diagnostic, never native qualification or permission for another run. No source change was made by this review.
