# Manual-release local schema review

Compared every byte to a24a818f: all prior schema bytes unchanged. Only two appended platform-only models: PlatformManualRelease and PlatformManualReleaseEvent. No existing model, enum, field, default, generator, datasource or migration changed. Parent notice stores exact digest/state/version and creation/update timestamps; index supports bounded history. Child events restrict parent deletion and uniquely bind record/version sequence. This is notice metadata, not executable action or owner authority. Proposed local definitions/owned fixture only, within the operational local grant; no production SQL or migration.

Previous current-source schema SHA256: 828d77dd15e3bcec557608e026afbe05f895fdfee6ac0b7f57a3fc982d1cec6e.
Reviewed schema SHA256: 6e7a5b4e988f62bcb2bb475095cf9a5470da2e5afdbabd21b3e7b1cae453abef.

Only the current mocked recipe helper SCHEMA pin is updated after this review. Engine/CLI/seed/profile and qualification:false remain identical. Historical Python/native packets and canonical issuer remain unavailable and unchanged. Generated local client must match current schema; no historical qualification is renewed.
