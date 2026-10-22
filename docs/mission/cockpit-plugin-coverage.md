# Cockpit integration and plugin acceptance

The cockpit catalog presents registered Axiom capabilities, not a mirror of a third-party marketplace. A listed capability does not grant credentials, tool access, or execution authority.

## Current capability boundaries

- GitHub, Slack, Microsoft Teams and Linear have browser authorization start flows. They require service-owned app configuration, a registered callback and valid scopes; provider authorization and backend validation remain separate.
- AWS, Azure and Google Cloud retain the existing paired-Agent enrollment flow. Azure cloud enrollment is not Azure DevOps OAuth; these must not be represented as interchangeable integrations.
- Airflow exposes bounded monitoring from a validated connection. Configuration and execution approvals retain their existing authority.
- Execution plugins expose registered AWS, Azure and GitHub operations and their required scopes. Their catalog descriptions do not imply provider execution has been tested.
- Curated skills install into the same workspace installation store used by the Agent. Repository code review, debugging investigation and Terraform review add read-only guidance over already registered repository tools. They cannot grant those tools or credentials.
- Arbitrary third-party MCP installation, including reference-marketplace entries such as Context7, Notion and Gmail, is not implemented. Do not add decorative install buttons or claim these providers are connected. Each needs an actual transport/enrollment implementation, secret handling, permission enforcement, revocation and runtime tests.

## Current release limits

Local role, sign-in, sign-out, navigation, skill mutation, policy and UI tests do not establish hosted Google OAuth, paid checkout, live provider consent, or installed desktop synchronization. An isolated staging configuration source has not been established. Configuration discovery must not substitute production credentials or mutate production. Production acceptance remains open.
