# Ordinary build-child group cleanup — local safety correction

Read-only review of the existing generation helper found poll/wait reaped its child before killpg(pid,0)/SIGKILL; numeric IDs can be reused after reaping. The exception path also signalled without checking whether that child was still held. No actual ordinary build was started.

The correction never probes/signals after returncode is known, requires default SIGCHLD before spawn, and limits cleanup to one attempt while the exact direct child remains unreaped. Reap is bounded5seconds; an unresolved reap returns/raises explicit cleanup_unknown. Normal exit0 remains compiler-exit evidence only. New producer metadata postReapGroupStatus=unqualified_not_signalled clarifies the unchanged unavailable descendant/runtime/activation contract. No new process discovery, PID adoption, permissions or identity authority.

## Test incident and corrected evidence

The initial red.log fourth test omitted its killpg mock. Popen was mocked, so no child was created, but the real old helper attempted a process-group probe and SIGKILL; both returned PermissionError. No successful signal was observed. This test-harness mistake was disclosed and corrected with a test-wide signal mock before any repeat. The initial log is retained as an incident/diagnostic, not described as an all-pure run or clean fourth-case RED.

corrected-mocks-red.log is the clean mocked baseline; green.log/final-green.log cover the corrected source. Five current mocked cases pass (reaped success, post-reap error, held timeout, unsupported reaping refusal, no cleanup retry); the additional unknown-reap case passes separately without repeating that group. All corrected runs replace Popen and every signal call; no actual child, signal, API/protocol, provider or deployment operation. No runtime/custody/quiescence qualification follows. The actual build remains unstarted and needs a newly frozen helper/revision/driver before execution approval.
