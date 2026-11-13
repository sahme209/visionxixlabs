# Actual isolated SQL result

220passed /9failed /0skipped of229. Original fixture and logs preserved; its server is confirmed stopped. This one-run approval is consumed. No retry occurred.

Failures occur before native credential access in workload paths. Source inspection identifies repeated acquisition of the same custodian lock inside one transaction; the actual SQL adapter refuses that, while the earlier memory fixture allowed it. A stricter memory regression reproduces the refusal. A local correction now retains only exact same-transaction lock acquisition metadata and rechecks original intent/source/barrier, including after final-owner awaits. This is NOT a corrected actual-SQL pass; new source review/frozen packet/fresh authorization are required.

Full Governance remains incomplete/disabled. No production or real credentials/provider actions occurred.
