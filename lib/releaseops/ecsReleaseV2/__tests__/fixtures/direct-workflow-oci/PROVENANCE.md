# Genuine direct-workflow OCI fixture

Upstream: `github/artifact-attestations-workflows`, numeric repository ID `804468129`, source/caller/signer commit `cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b`, `.github/workflows/ghcr-publish.yml`, `refs/heads/main`, run `10782915115`, attempt 1. The unchanged signed subject is `ghcr.io/github/artifact-attestations-workflows@sha256:06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92`.

Permission was checked through read-only public GitHub access on 2026-10-16. The exact source commit's [LICENSE.txt](https://github.com/github/artifact-attestations-workflows/blob/cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b/LICENSE.txt) is **CC0-1.0**, retained unchanged here; Git blob `0e259d42c996742e9e3cba14c677129b2c1b6311`, 7,048 bytes. The exact recursive commit tree also identifies the [workflow](https://github.com/github/artifact-attestations-workflows/blob/cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b/.github/workflows/ghcr-publish.yml) blob `b3f2aedd9834c78d8dc005375ec389c9f35d819d`; refetched workflow bytes matched the previously cached source. This permission is from the fixture repository itself, not the CLI license used by the separate existing test root.

The bundle, descriptor manifest and image index were previously obtained through bounded read-only public GHCR metadata/blob requests during the composition investigation, documented in `d6628e4e:docs/plans/2026-10-16-paired-ecs-review-composition-spec.md`. Descriptor digests/sizes match these unchanged bytes. This package fetched no image/chart payload layers and performed no remote workflow run or provider write.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| bundle.sigstore.json | 10973 | 49edde03a1879f18b95f03fb8b691137e6d3718fc21f64a22909b14fbb472c89 |
| image-index.json | 1607 | 06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92 |
| bundle-manifest.json | 813 | aa5e53aa720c58532973c396630d4cd0d9df9cde9ae13ab509f20770554abef5 |
| workflow.yml | 1879 | ab7e725dc352ce2a8f4d9bbe4d3f76cdee1709bf1f8514c20a9878a9a12df585 |
| LICENSE.txt | 7048 | a2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499 |

Only the small index/descriptor and signed provenance are retained. DSSE does not establish artifact media type, registry transfer, AWS authorization, image pullability, application health, deployment, recovery or tenant authority. Tests use the existing separately documented official CLI test root; that root is not production configuration or a current production trust approval. Synthetic GitHub HTTP metadata used with this genuine signature stays synthetic. Installed dependency overlay has protobuf-specs 0.5.2 versus lockfile 0.5.0; clean CI remains authoritative.
