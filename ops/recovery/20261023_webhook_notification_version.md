# Explicit Stripe notification version

The authorized existing Stripe sandbox uses default webhook notification version 2025-12-15.clover. Its temporary official CLI forwarder was stopped before any acceptance payment because Axiom correctly rejected the mismatch with its 2024-06-20 notification contract. No event version, signature or collection proof was rewritten, and no account default or Visanova endpoint was changed.

`AXIOM_STRIPE_WEBHOOK_API_VERSION` now explicitly selects either reviewed notification schema: 2024-06-20 or 2025-12-15.clover. Unset retains the existing production contract. Empty, latest and unreviewed versions fail closed before provider lookup. The signed event must exactly match the selected version, account and mode.

Only notification identity/type/ID are used as routing hints. Canonical account, price, subscription, invoice, charge and collection evidence are still retrieved and validated with the SDK pinned to 2024-06-20. Neither event metadata nor its paid/status fields grant access. New tests exercise this separation with forged notification metadata and explicit version mismatch/configuration refusal. Production configuration and deployment remain unchanged; Clover is enabled only in the isolated local sandbox runtime for acceptance.
