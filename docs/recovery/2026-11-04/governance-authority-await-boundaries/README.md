# Governance authority await-boundary verification

Nine new focused cases pass against the actual private requestAuthorityCore, with a simulated paired-session resolver and transaction reads. One positive path requires both current-principal resolutions and two locked-read calls. Refusal paths cover initial-resolution cancellation before reads, cancellation during the last locked read, final paired session/user/organization drift, final API-key substitution, null final resolution (revocation), and cancellation while the final resolver itself is awaited.

The checks verify that initial authority cannot become cached success after these events. They found no runtime defect and changed no authority or admission mechanism. Current private-merge source review likewise established no reproducible defect; its existing composition checks stop at issuer refusal and are not successful merge enforcement proof.

Only the new file was executed, using existing Vitest4.1.11/fixedNode24.21.0, an owned config/cache/emptyenvDir/home/tmp, scrubbed environment and kernel network denial. Exit0,9passed,0skipped; owned process reaped. Exact command, profile/config and output retained. Prior passing suites, DB fixtures, native experiments and provider requests were not repeated.

This is local simulated authority verification, not actual session revocation, real PostgreSQL lock behavior, same-artifact custody, fleet coverage, native policy review, provider execution or Governance enrollment acceptance. Canonical issuer remains unavailable; the pending909experiment and separate human/provider/deployment gates remain untouched.
