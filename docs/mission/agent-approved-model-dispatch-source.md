# Agent approved-model preference: backend source checkpoint

This phase wires an optional desktop message preference into the existing Agent
decision loop and governed Gateway extraction. It is source-only: it does not
change workspace model approvals or service enablement, change a price, call a provider, configure a secret, migrate a
database, deploy the website, or release a desktop installer.

## Boundaries and current authority

- `preferredModel` is optional. A supplied value must be a concrete Gateway ID
  of at most 200 characters, with explicit `preferredProvider: vercel_gateway`.
  Managed `service-default`, virtual `vmc/` routing IDs, wrong scalar types and
  malformed IDs are rejected before a conversation turn is persisted. A desktop
  client using the managed default omits this field.
- Trusted organization/session actor remains server-supplied. The resolver keeps
  actor identity as its third argument and adds preference as optional fourth.
  Model IDs are not authority, tool instructions, user roles, or provider grants.
- A chosen ID must be approved by current workspace v1 metadata, or equal the
  exact concrete legacy default, and be present in the current service-filtered
  Gateway catalog. Service configuration and workspace provider enablement are
  still mandatory. There is no fallback to an unapproved or different model.
- Initial resolution and each following extraction/repair re-read policy,
  configured service status and the relevant catalog before reserving credit.
  Dispatch uses the existing catalog loader's server-owned `current` mode, which
  uses `cache: no-store`; other callers retain the existing 900-second catalog
  cache. Service model allowlists are applied on every catalog read.
- Omitted managed `service-default` or existing legacy `vmc/` defaults retain server-controlled
  routing semantics without introducing a catalog dependency for that legacy
  lane. Concrete workspace defaults are revalidated when used. A current policy
  refusal uses existing fixed error codes and stops the decision loop instead
  of being mistaken for malformed JSON and authorizing another paid repair.

The current-authority checks are snapshots at each extraction boundary. This
does not claim an atomic policy-revocation lock spanning catalog, credit admission
and provider handoff, or prevent a provider from retiring a model after its
catalog response. Existing membership/credit dispatch claims remain transactional.

## Preserved financial and product gates

Every actual extraction still obtains its existing independent hold, including
repair. One-use task binding, trusted actor scope, uncertain-hold retention,
singular attributed usage before parsing, one Gateway attempt with SDK retries
disabled, and the 4096-token output bound are unchanged. Tool permissions,
approval requirements, tenant isolation and proposal execution are unchanged.
This phase does not add other providers, streaming, dynamic pricing, or billing
permissions. The generic generation endpoint is unchanged by this phase.

Inert tests exercise actual handler validation, loop argument propagation,
policy/resolver intersection, selected-ID handoff to a mocked SDK, current
allowlists, no-store dispatch reads, and revocation before later/repair holds.
Those tests do not establish actual provider cost or native application success.

Release blockers remain: actual selected-model/provider and reasoning-cost
qualification against the reservation ceiling; authoritative Gateway cost lookup
and settlement; isolated financial/application acceptance; native desktop
validation; and the existing final deployment/release approval gates. New TEST
Free still cannot fit the unchanged 1000-cent default hold in a 200-cent allowance
without separately reviewed isolated configuration. No pricing or approval gate
is weakened to claim completion.
