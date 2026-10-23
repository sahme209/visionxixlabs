# Active desktop Agent HTTP/database acceptance

A new opt-in test passes a synthetic authenticated desktop principal through the actual message HTTP route, workspace Agent/model policy, catalog parsing, credit admission, manager, installed SDK protocol, environment read tool, audit/action rows and conversation persistence. Provider transport is a fixed non-network `.invalid` fixture; public catalog/pricing responses are also fixed fixtures. This is not real sign-in, native UI or paid model acceptance.

The first fixture iteration incorrectly returned endpoint-pricing JSON for the model-list URL. Correcting the fixture to return the two actual public endpoint shapes made the six original route cases pass; this was not evidence of a production policy defect.

A subsequent regression froze the clock across distinct requests in the same workspace. The old timestamp-only correlation ID reused a durable reservation key and failed the second request with AgentStreamInterrupted. The route now creates a UUID correlation ID, keeping distinct requests independent without increasing permissions, reservation amounts or retries.

The final nine HTTP cases cover JSON/streamed completion, durable tool/action/conversation records, two linked 100-cent holds, unrelated selected repository context, foreign workspace, foreign user, unauthenticated access, disabled identity, cancellation without invented completion, and same-clock request independence. Some cases check multiple properties. The portable owned-PostgreSQL runner executes these after the earlier settlement tests to avoid pending-hold interference, then coding and approval guard tests. Final fixture results and source release checks are recorded separately.

One real native Sonnet environment-list acceptance remains unused and blocked by the locked Mac. No customer session, live model request, new tool grant, production database mutation or real provider action was used in this test. The unrelated working-tree legacy GitHub credential draft is not part of this narrow release.
