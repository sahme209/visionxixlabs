# Actual registry path correction

PR339 e706 failed before installation with LGHT0204/ICE03 for the two new legacy RegLocator paths. Pinned Handlebars6.3.0 removes one escape before template expressions and preserves literal backslashes. Only two final literal separators changed; identities, ownership, rollback and validation gates remain.

84 affected portable checks and15 demo contracts pass. Quick43791743310/job133051496162 at69e9cb10 reproduces both original ICE03 failures and links the corrected registry-only MSI using managed WiX3.14.1.8722 with validation enabled. Source checks and owned cleanup pass; no app/Rust build, packages or installer execution. This is a source-grounded key fragment, not a complete substitute Tauri renderer. Full candidate installation/upgrade checks remain required before merge/publication.

Production Google identity migration and read-only verification succeeded separately. Real Google sign-in/pairing/public V19 downloads remain unverified. No Vercel deployment or Governance enablement. Full parser files stay in the private cache; public provenance contains URLs/hashes.
