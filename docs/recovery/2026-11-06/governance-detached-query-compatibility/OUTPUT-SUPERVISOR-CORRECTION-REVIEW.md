# Output-only signing supervisor — proposed one fresh exact bundle

## Root cause and correction

The consumed compat-2 signer exited-25/SIGXFSZ after `replacing existing signature`. Source establishes RLIMIT_FSIZE65536 covered the17MB artifact as well as log output. This was our harness defect. The earlier HOME correction remains supported as a compatibility precaution, but neither this signal nor the identity check causally proves HOME caused the first failure.

Use the existing final_seal.py selector/pipe approach, with an owned child group: bounded_signing_tool.py captures stdout+stderr through nonblocking pipes to a shared64KiB buffer,10second deadline, at most5seconds owned cleanup, stops on overflow/error/prompt/unknown, no retry. It does NOT apply the log allowance as a file-size limit to codesign. This is not a new filesystem sandbox or promise to restrict every OS/helper effect. All signing commands remain fixed existing-company-key/identifier/Runtime/emptyentitlements/no timestamp. No key export/unlock/access grant. The same-group cleanup is used only while the exact original child remains unreaped; no descendant-quiescence guarantee.

Node’s load still uses the original private HOME/TMPDIR and network-denied/write-bounded supervisor, including its small-file cap; it does not write the library. Structural comparison, static verification, mode-restoration and original-byte gates stay unchanged. Five mock supervisor checks cover normal output, output overflow/one cleanup, deadline, launch errors and unknown cleanup; orchestration regression proves signer cannot call the old artifact-size-limited helper. Actual signing/load are not tests.

## New frozen run, not a retry grant

Fresh compat-3 packetd28c2eb9d2b68fab262119293ac0f463188db7ad18e935901aef71bafcf79064,9sourcebindings/6inputs, exclusive new copy. Compat1/2/identity diagnostic grants remain consumed. Conditional actual execution requires new explicit approval after source/packet independent review. Request ONE signing/staticverify/display/export-only load bundle under these limits. On any failure stop without another experiment. No original mutation, library-validation weakening, query/database/privateconsumer/custodian, installation, provider action, deployment or spending. Compatibility success alone does not establish Governance.

Independent exact source/packet review PASS. No GUI prompt acceptance or interaction is permitted; a stalled prompt is bounded by timeout, not explicit GUI detection. Fresh exact-run decision remains pending.
