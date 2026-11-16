# Exact-byte release checkout overlay

Two-file outside-only overlay against workflow a0eb48cb929134186b5a673cde546103f99a986f53b6141d2d841b9187896883 and fixture71896e7eea5b04b60d525c38fde05dfddd339d056b209077aed1a45b604eaa18. Earlier frozen90b407 packet is unchanged.

Only the build matrix checkout receives the existing proven installed-QA Git LF recipe (GIT_CONFIG_COUNT=1, core.autocrlf=false), exact github.sha ref, and persist-credentials:false. Other checkouts, authority, release guards, bytes/receipt acceptance, signing flags, deadlines and publication settings remain unchanged. This prevents Windows CRLF conversion from invalidating the full reviewed source closure after the expensive build, and removes unused persisted checkout credentials from subsequent build commands.

Node24.21.0 runs the actual YAML/embedded-script fixture: corrected50PASS; original workflow49PASS/1FAIL. New actual-checkout contract also mutates source to prove refusal for wrong LF value/key, missing Git count, wrong ref and persisted credentials. Tests use only fictional files and existing dependency; no checkout/network/native/build/account/signing/publication action occurred. Root applies/reviews this coherent overlay before final inventory minting and normal CI; no release readiness is claimed.
