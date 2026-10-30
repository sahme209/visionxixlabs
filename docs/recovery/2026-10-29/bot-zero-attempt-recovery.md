# Keep trusted no-input outcomes out of unknown-write recovery

Live October 30 native confirmation returned expired, attemptCount 0, inputPerformed false; the document remained exactly Axiom acceptance before. This is a safe refusal, not successful computer acceptance. Native durable ledger correctly contains only claimed attempt-one outcomes, and its directory was empty. Returning to the app nevertheless recovered a locator for the zero-attempt action, producing unknown and overriding the explicit no-input receipt.

Repair: after native result schema validation, exact pointer matching and current owner/epoch checks, clear only the local recovery locator for expired/stopped/refused with attemptCount zero and inputPerformed false. Do not clear any confirmed, attempted or uncertain outcome. A clear failure retains existing fail-closed unknown handling. This does not repeat input, clear native audit history, grant authority, extend deadlines or relax foreground/native confirmation.

Regression was RED before the fix. Controller/recovery-store/panel checks: 36 passed. Independent review: no important/critical findings. Existing historical unknown locator is preserved; no blanket cleanup or migration. A separately authorized fresh exact test remains pending, not consumed by this local repair.
