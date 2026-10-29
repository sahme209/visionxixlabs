# Pipeline cost-read execution boundary

The runner previously converted a failed cumulative-cost query to zero and an unreadable workspace budget to an absent override. It now fails the claimed stage before calling its executor when either lookup fails or cumulative spend is negative, fractional, non-finite or unsafe. A verified absent optional workspace configuration still uses the existing platform default. The loader adds an opt-in strict read; existing display callers retain their old behavior.

The actual runner regression tests reproduced five failures before the fix; all seven boundary cases and 38 adjacent cap/telemetry cases pass afterward. Independent review found no blocker. These are synthetic DB/executor tests, not live provider or customer workflow acceptance.

This change does not account pending provider holds or projected/concurrent run spending and does not establish a hard provider-spend ceiling. It does not reset historical pipeline rows, change budget amounts, grant permissions or make external provider calls. Release validation is recorded separately.
