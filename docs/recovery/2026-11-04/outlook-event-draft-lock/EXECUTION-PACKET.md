# Outlook event draft consistency repair

1. Outcome: calendar start/end follow the same pending/uncertain draft editing lock as all other Outlook action fields.
2. Owner/dependencies: root uses debugging/TDD; adapter reviews. Existing React/TestingLibrary/Vitest only; no dependencies.
3. Baseline:50d79530/runtime916 currentapp alreadyopen; source OutlookActionsPanel has busy||uncertain on kind/recipients/subject/body but not two datetime inputs. Prior Outlook package is approved localcode/tests; current read-only/sending activation unaffected.
4. Change/non-goals: reproduce actual rendered form with deferred transport, then add only matching disabled guards to two event inputs. No approval/dispatch/recovery/UTC conversion/transport or provider scope change; no refactor.
5. Boundaries: mocked Outlook transport/context, synthetic draft data; no OAuth/consent/mail/calendar/provider/DB/native action. Do not modify/restart currently open app.
6. Acceptance: fields editable initially; lock while save pending and after uncertain save; unresolved read does not unlock; confirmed saved-draft read clears uncertainty. Preserve exact times/request payload and single original save, no retry.
7. Proof: component RED→GREEN and localtypes/independentreview only, not actual Outlook/native/customer acceptance. No fullsuite or duplicate previously passing batches under user conservation instructions.
8. Recovery: reversible source/tests/guide supplement, no external effects. Original unknown actions remain preserved.
9. Spend/authority: zero external; existing-function repair under approved local Outlook implementation. No deploy/buildCI/permissions/actions/credential/newboundary.
10. Evidence/next: retain expected RED and exact GREENlogs/config/profile/source hashes, update affected guide as historical plus supplement, board/derivedviews/bundle. New source not in current signedapp and not shipped.
