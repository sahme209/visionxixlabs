# Retained same-font local source preparation

Root's actual offline Next attempt at source b964 passed the build contract but
failed `next/font/google` network fetches for Inter and JetBrains Mono. The failed
`/private/tmp/axiom-isolated-b9649927-a6uzltb3/build-run` is preserved unchanged.
This increment prepares source assets only: no build, generation, retry, deployment,
external font/license fetch, or modification of either retained stage occurred.

## Exact retained input and metadata

All **13 WOFF2 files / 305,208 bytes** were copied unchanged from
`/private/tmp/axiom-deployment-baseline-production-vpje2mso/.next/static/media`.
The retained successful build source is
`eae00077ee130731d7721bc9dd5b544054867b05`, source archive SHA256
`2ed0870862beb9441224aa176c5c12657a8d8f3e83c767dabdb70f94969c9db6`.
These are local source/build references, not vendor authenticity or issuer identity.
Each source file was read through the bounded stable-descriptor reader and copied
exclusively. `public/fonts/provenance.json` records all exact sizes/SHA256 values,
the old CSS identity, parser identity, and per-file metadata.

The verified installed Next 16.4.2 bundled fontkit parser inspected actual font bytes
under network/write denial. Inter is Regular, version `4.001;git-66647c0bb`, weight
axis 100–900/default 400; JetBrains Mono is Regular, version `2.211`, weight axis
100–800/default 400. Embedded copyright records identify the Inter Project Authors
(2016, rsms/inter) and JetBrains Mono Project Authors (2020, JetBrains/JetBrainsMono).
Embedded license URLs point to openfontlicense.org and scripts.sil.org/OFL. Those
records contain no full license text and are not a complete redistribution notice.

| Family | Retained subset | Asset file |
| --- | --- | --- |
| Inter | Cyrillic extended | `ba9851c3c22cd980-s.woff2` |
| Inter | Cyrillic | `21350d82a1f187e9-s.woff2` |
| Inter | Greek extended | `c5fe6dc8356a8c31-s.woff2` |
| Inter | Greek | `19cfc7226ec3afaa-s.woff2` |
| Inter | Vietnamese | `df0a9ae256c0569c-s.woff2` |
| Inter | Latin extended | `8e9860b6e62d6359-s.woff2` |
| Inter | Latin, preloaded | `e4af272ccee01ff0-s.p.woff2` |
| JetBrains Mono | Cyrillic extended | `886030b0b59bc5a7-s.woff2` |
| JetBrains Mono | Cyrillic | `0aa834ed78bf6d07-s.woff2` |
| JetBrains Mono | Greek | `67957d42bae0796d-s.woff2` |
| JetBrains Mono | Vietnamese | `f911b923c6adde36-s.woff2` |
| JetBrains Mono | Latin extended | `939c4f875ee75fbb-s.woff2` |
| JetBrains Mono | Latin, preloaded | `bb3ef058b751a6ad-s.p.woff2` |

The complete retained face-map acceptance SHA256 is
`056b263b45c747a74809e0e605bf5556dd126bbe4759727abf4dde9e8f784333`.
This is an asset regression reference, not an executing artifact capability.

## Source behavior

`styles/local-fonts.css` preserves each retained normal-style variable face's exact
unicode range, weight range and `font-display:swap`. It preserves Arial fallback
metrics: Inter 90.44% ascent / 22.52% descent / 0.00% gap / 107.12% adjustment;
JetBrains Mono 75.79% / 22.29% / 0.00% / 134.59%. Static body classes preserve
`--font-inter`, `--font-mono`, Inter/Inter Fallback family and normal style, together
with the existing antialiased class. Existing OpenType settings and the more
specific platform-first application override remain unchanged. Only the two former
Latin preload faces are preloaded from local URLs.

`app/layout.tsx` no longer calls/imports Google font loaders, and `app/globals.css`
no longer contains its separate remote Google CSS import. No system-font substitute,
static-weight substitute, dropped subset, fake loader response, or mock font asset
was used. This preserves the retained build's exact font bytes/declarations; it does
not claim live-Google provenance, pixel-identical rendering, a visual browser check,
or equivalence to whatever the formerly dynamic remote CSS might return today.

## Checks and remaining gate

RED: `/private/tmp/axiom-local-fonts-red.log` (real remote import plus absent assets).
GREEN: `/private/tmp/axiom-local-fonts-green.log`, **4 tests pass**.
Command: `python3 -m unittest discover -s scripts/tests -p test_local_font_assets.py`.
Tests reject remote font entrypoints, check all 13 subset files/declarations and
exact asset/map hashes, variable ranges, fallback metrics and Latin-only preloads,
and parse actual font metadata to check families/versions/axes. No build is claimed.

Official notices remain pending. The source provenance record explicitly states
`licenseStatus:pending_official_notices`,
`publicationStatus:blocked_pending_license_notices`, and upstream authenticity
unavailable. No license text was invented, no complete redistribution claim made,
and no permission to publish inferred. Root owns the separately pending narrowly
scoped official notice reads. Any later notice/status update must preserve this
history and its actual evidence. Final review and notices precede a fresh exact
source/build attempt; the old failed attempt is never overwritten or retried in place.
