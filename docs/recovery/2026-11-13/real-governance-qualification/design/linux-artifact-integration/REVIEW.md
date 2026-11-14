# Independent review — connected Linux artifact proposal

Verdict: architecture direction is sound, but NOT ready as an exact connected implementation scope. The proposal honestly identifies missing authority suppliers rather than falsely implementing them. Those suppliers still need concrete design before presenting this as one implementable end-to-end bundle.

## Important unresolved implementation choices

1. **Native lifecycle/disruption authority is still a requirement, not a supplier.** PROPOSAL.md:21/28–29 refer to authenticated bootstrap/supervisor relationships; :46 explicitly says their implementation is missing. Specify the actual fixed launcher/supervisor process, original child identity mechanism, inherited private channel/descriptor map, generation creation/retirement, and the real disruption observation source. Define how startup, producer exit, supervisor/channel loss, restart and marker change fail closed. Process ID or payload generation alone is insufficient. Do not introduce another caller-created “qualified” callback.
2. **Clock projections/rates remain unspecified authority.** :33 says previously qualified premises from a protected profile, but :48 admits no supplier. Select the precise/coarse clock APIs and actual source-backed conversion/quantization/rate/age evidence representation, its trusted operator/native issuer and profile binding. If unavailable, explicitly scope any implementation as a raw capture bridge that CANNOT construct an admitted ExecutionTimeSource; do not promise connected real Governance from it. No guessed constant/error margin or generic accepted-evidence boolean resolves this.
3. **Actual fixed resource path/worker ABI is deferred.** :28 correctly fixes the basename `current` and retains the original FD. However, :21/30/46–47 leave the owning generation-directory/bootstrap handles, fixed executable/addon identity/path, descriptor numbers/rights and full framed result format undecided. Freeze those finite coordinates/protocol, complete byte cap and ownership transitions before source implementation. The C struct must not become the wire protocol. Preserve same original held FD throughout final P2/currentness; a reopened latest file is not repair.
4. **Build work and preparation-only permission are mixed.** :19–20 say reconstruct/compile/link, while title/status and :54 hold actual build/execution. The implementation decision must distinguish preparing a reviewed build recipe from invoking it. It also cannot claim a closed manifest while :44–45 lack main/Cargo/dependency/target inputs. No speculative input hash or extra source read is implied.

## Already concrete and correct

The proposal retains the actual original graph and one shared clock; holds public/default enablement; chooses a parent-owned immutable source FD plus synchronous owned child and reap-based completion; requires fresh final P2; does not confuse resource identity or `time_authority=0` with clock/lifecycle authority; and preserves existing native/build/resource/provider/custody gates.

## Minimum next decision

Complete the four finite design choices above in the same proposal before requesting an implementation grant for a connected supplier. Alternatively, request a clearly labeled raw-capture-only source unit with the admitting clock constructor unavailable; that is a smaller local deliverable, not full native qualification. No additional tests, native execution, research, code edits or provider calls were performed for this review.
