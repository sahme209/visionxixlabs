# Real local Airflow adapter acceptance

Axiom’s Airflow adapter was exercised against an actual Apache Airflow 3.3.2 engine in an owned, private, loopback-only environment. This closes the gap between mocked HTTP coverage and a real engine response. It does not establish customer HTTPS connection storage, application approvals, desktop controls, or production cloud automation.

## Verified

- Authentication, version inspection, and discovery of the randomly named owned DAG.
- Incorrect credentials refused.
- Triggering a two-task no-op DAG and observing both tasks succeed.
- Replaying the same occurrence returns a conflict and leaves exactly one run.
- Missing DAG returns not found. Production origin validation continues to reject private HTTP origins.
- Three actual-engine tests passed; the ordinary Airflow suite passed 123 tests, with these three opt-in tests skipped. Root TypeScript checks passed. Independent review found no blocker.

## Reproduction and isolation

`scripts/test-airflow-engine.py` requires explicit private Airflow virtual-environment, fresh private output-directory, and Node paths. Run it with the virtual environment’s Python. Airflow must be pinned to 3.3.2; the test used Python 3.12 and the matching official constraints. Installation guidance: [Apache Airflow installation](https://airflow.apache.org/docs/apache-airflow/stable/installation/installing-from-pypi.html).

The runner scrubs inherited credentials, accepts no external service URL, creates only its own no-op DAG, and starts its API on 127.0.0.1. Credentials and engine logs remain private. The test independently validates fixture location, ownership, permissions, engine version, DAG identifier and fixture tag before triggering.

Cleanup tracks descendant process identities while the parent lives and scans the owned process group after parent exit. It verifies that owned processes have stopped and the port is closed before removing the temporary home. Uncertain cleanup retains files and fails. Fresh output directories prevent old successful receipts from masquerading as a new successful run.

The final receipt confirmed owned process group empty, port closed and temporary home removed. No provider inference, customer credentials, production changes or cloud actions occurred. No authorization or private-origin policy was weakened.
