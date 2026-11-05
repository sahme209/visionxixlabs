# Outlook nonexistent local-time validation

1. Outcome: refuse invalid/nonexistent local calendar times instead of silently creating a draft with a different local time.
2. Owner/dependencies: root debugging/TDD, adapter review; existing Date/React/Vitest only.
3. Baseline: d20dd1b5. request() currently uses new Date(start/end).toISOString. Actual isolated Node timezone check America/New_York maps2027-03-14T02:30 to03:30/07:30Z, proving normalization at that conversion boundary.
4. Change/non-goals: rendered form reproduction, then narrowly validate local datetime syntax and exact local-component roundtrip before existing UTC conversion. Preserve valid input and existing generic validation message/independent approval/UTC transport. No new timezone picker, overlap/fold guarantee, provider boundary or automatic correction.
5. Boundaries: synthetic form and mocked transport; no actual mailbox/event/OAuth/provider/customerdata/DB. Fixed owned test environment timezone; no system timezone/settings changes.
6. Acceptance: nonexistent start or end refuses with zero draft mutations; valid spring-forward adjacent time and ordinary date retain exactUTC; invalid calendar dates refuse. Preserve optional seconds/milliseconds if present, no arbitrary dateonly/timezone-qualified inputs. Ambiguous fall-back choice remains existingJS behavior and must not be called disambiguated.
7. Proof: local rendered/pure RED→GREEN plus types/review; not native/provider/calendar acceptance.
8. Recovery: reversible local helper+two callsite replacements; userapp remains untouched/unrestarted.
9. Spend/authority: existing Outlook local implementation/function repair only, no new permission/contract activation/credential/spend. No deployment/CI/realAI/909 action.
10. Evidence/next: preserve actualRED/sourcechecklogs/pinnedtimezone/config/profile/results/hashes, guide supplement/board/bundle; incomplete overlap/native/live gates remain explicit.
