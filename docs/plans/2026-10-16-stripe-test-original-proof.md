# Inactive Stripe TEST original-attempt adapter

Approved scope: internal adapter only; no routes, activation, migrations, live keys,
legacy customers or support payment changes. Reuse existing intent JSON CAS and
single billing-event consumer, with no new financial ledger.

1. Add optional original-create proof to the existing trusted provider contract.
   Capture original outbound bytes/key/account and actual SDK response identity;
   atomically persist proof and confirmed session before releasing the URL.
2. Add explicitly constructed TEST SDK adapter. Independently read the current
   account, require test sessions/prices/events, validate configured catalog terms
   and current product/subscription shape. Optional response headers remain
   optional observations; contradictions fail closed.
3. Verify raw webhook signature, then retrieve current provider state. Metadata
   is only a lookup hint: no grant without previously captured exact session proof.
   Unknown outcomes without proof remain held; no retry or reconstruction.
4. Provider-simulated regressions cover original proof, mismatch/missing proof,
   optional headers, storage failure and late signed event replay. No actual
   Stripe access, hosted checkout or payment acceptance is claimed.

Required independent security review and exact integration checks precede merge.
