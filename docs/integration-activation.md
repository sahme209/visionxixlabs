# Activating release integrations

The browser companion never collects a provider credential. A workspace owner
starts consent, Axiom stores only encrypted provider credentials and a digest
of the one-time state, then the service must complete a live validation before
the connection is shown as active.

## Shared requirements

- Set `NEXTAUTH_URL` or the configured Axiom application URL to the final
  HTTPS origin. Callback URLs are generated only from that trusted origin.
- Register the exact callback URI shown below; do not use wildcard callback
  domains.
- Store client secrets only in the production secret manager. Never expose a
  secret through `NEXT_PUBLIC_*`, a Git repository, or the browser companion.
- Activate integrations one provider at a time, validate a harmless read, and
  confirm the Integration Center shows **Active** before using it for release
  evidence or notifications.

## GitHub App — primary release evidence

Set the GitHub App slug and the server-side App credentials used for
installation-token validation. In the GitHub App configuration, set the
**Setup URL** to:

`https://<axiom-origin>/api/integrations/github/install-callback`

Install the App only on selected repositories. Begin with read-only access to
repository metadata, contents, pull requests, Actions/workflows, and deployment
metadata. A GitHub install is only **recorded** after consent; it becomes
**read-only validated** only after Axiom Agent completes its scoped API read.
Do not grant write, administration, or repository-wide access merely to enable
release evidence.

## Slack — release notifications

Set `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`. The callback is:

`https://<axiom-origin>/api/integrations/slack/callback`

The initial consent asks only for:

- `channels:read`
- `chat:write`

It does not request direct-message, private-channel, command, or broad history
access. Any expansion needs a separate security review, a scoped product
feature, and a new consent cycle.

## Microsoft — tenant identity before Teams messaging

Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and
`MICROSOFT_TENANT_ID`. The callback is:

`https://<axiom-origin>/api/integrations/teams/callback`

The initial authorization code flow uses PKCE and requests only:

- `openid`
- `offline_access`
- `User.Read`

This validates tenant identity; it does **not** permit Teams chat or channel
messages. Messaging scopes must remain off until a separately reviewed and
validated capability is ready.

## Revocation and revalidation

Owners can revoke an Axiom-recorded connection from the companion. Removing an
App or consent in the provider console is a separate provider-side action.
Connections whose validation is older than 24 hours show **Needs attention**
until a fresh server-side validation succeeds.
