# Local native-preflight receipt repair

Implements the user's approved bounded timing repair. A server-only, request-local helper runs real native validation and current authority before creating a receipt. Receipt keys include the complete candidate and association reference; they expire within15seconds and the candidate deadline, reject clock rollback, and are consumed once. No client field, storage row or token can supply a receipt.

Only an associated ServiceNow evidence link may use it in place of the first duplicate in-transport native check. The final fresh native read immediately before mutation, all durable authority checks, credential/marker/absence checks, execution budget and lease remain unchanged. Publish/close paths do not use it. Missing, changed or expired receipt falls back to the original validation path.

38 helper/composition/transport checks passed, then28 transport checks passed after added authority/credential negative cases (overlapping suites). Backend production types passed. Independent review found no blocking issue; its optional negative-case coverage was added. The modeled pre-write failure now passes with a valid receipt, retaining the final fresh native read. The confirmation in that test is explicitly a fast mocked fixture; no live total-budget success or historical-cause proof is claimed. The full isolated production build and its TypeScript check passed.

Not deployed. Current production remains049a9df0, and originalb38 plus child7292 remain refused/consumed. This repair authorizes no resend, new child generation or provider write. Any further recovery needs a separately reviewed bounded design and exact human approval. Keep production changes batched to respect deployment costs.
