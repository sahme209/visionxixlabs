# Corrected component invocation: actual bundle-alias refusal

User `call_ek0CNfrHjEQ4p0qBn77xxnPq[0]` approved one corrected invocation of manifest25129462…906ca368. The source-hash-verified driver ran once and exited1 before ServiceManagement status construction or registration: native preflight exit65, `exactCallingBundle:false`. Unlike the earlier driver, it retained its exclusive result journal and actual failure result.

Foundation returned `/tmp/axiom-origin-unit-prepared-2d_6kwi8/...`; the literal expected path used `/private/tmp/...`. Immediate actual filesystem inspection established these app paths are the same object and share the same real path. The byte-string comparison was therefore an implementation defect, not evidence of a different bundle. No registration, broker/controller/XPC, cleanup or issuer initialization occurred.

The exact invocation authorization is consumed and artifacts preserved. Routine local repair must canonicalize the expected and observed owned app/main filesystem identity, retaining rejection of different copies, executables and bundle IDs. An ordinary Foundation-only inspection path should be genuinely tested before another service experiment. This result does not authorize a retry or qualify identity. See the exact driver result.
