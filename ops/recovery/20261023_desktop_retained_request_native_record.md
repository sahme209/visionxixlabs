# Desktop retained request verification

Source `5a983e8dd33cc9c04b0185194753b974215b713d` is pushed. Exact archived source passed 10,100 tests, zero failures, 140 opt-in skips, root typecheck and desktop frontend build. All 4,401 tracked file hashes remained unchanged, including after the local native build.

The local debug 0.1.21 native build completed successfully. Opening the rebuilt application preserved the verified production session, completed read-only Agent conversation and Inspect mode. The composer was empty and no request was submitted. This confirms native startup compatibility and persistence, not a native failure/restore acceptance: that behavior is fixture-tested. No signed installer was published and no additional paid inference, permission change or payment occurred.
