# Terraform generation HTTP error privacy — local repair

The actual generate route returned arbitrary database/generator Error.message in its 500 JSON response. Two synthetic sentinel cases reproduced that disclosure. The response now uses a fixed public string while preserving its status and JSON shape. Replacing only that literal reconstructs the whole prior Git source exactly; internal logging, token/rate/body validation, success response and generation arguments are unchanged.

The final six real-handler tests pass with mocked authentication, rate limit, database and generator ports: two privacy cases and four compatibility controls. Independent read-only review passed. No Terraform generation, provider call, real job/token/AI/DB operation occurred. This is not a server authorization-bypass claim or proof that actual customer secrets leaked. Internal diagnostic redaction/access controls and complete security acceptance remain separate requirements.

Only a response value changed from string to fixed string. No new runtime type/interface/dependency was introduced; no root type/full build or production acceptance is claimed. Current475desktop and production are unchanged. All21master parents, Governance trust gates and deployment/spending restrictions remain open.
