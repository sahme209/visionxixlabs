# Website contact and recorded-request controls

Internal source draft for local revision df9d58ab. Not published/customer-eligible, editorially approved or accepted media. Evidence keys below identify source ranges, not installed control IDs. No form was submitted to create this guide.

## Choose this flow

Use `/contact` when documentation or in-product recovery leaves a product, account, download, security or press/partner question. Opening the page does not open a support ticket, change access, grant production approval or start AI. The exact query `topic=axiom-production-access` prepopulates a product question about production access; other values use the ordinary blank-message form. This is navigation context, not an entitlement. [page-entry, form-state]

## Control inventory

| Documentation key | Control | Behavior and limit |
| --- | --- | --- |
| website.contact.name | Name | Required text, autocomplete name, maximum240characters. |
| website.contact.email | Work email | Required email input, autocomplete email, maximum240characters. The label does not establish company ownership or enterprise identity. |
| website.contact.topic | Product question / Download help / Security / Support / Press / partners | Local topic selection and explanatory hint; defaults to Product question. Selection does not submit or grant provider permissions. |
| website.contact.message | What went wrong? | Required textarea, maximum8000characters. Describe the step, expected result and error; never include passwords, tokens or cloud secrets. No attachment upload is present. |
| website.contact.send | Send → / Sending… | POSTs the form once per handler invocation to `/api/contact`; button is disabled during submitting. Client checks required trimmed fields. This does not establish server-wide deduplication or an exactly-once request. |
| website.contact.mail | support email link | Opens the user's mail handler; clicking does not itself prove a message was sent or received. |
| website.contact.product | Review capabilities | Appears after confirmed recording; navigates to `/product`. |
| website.contact.plans | See plans | Appears after confirmed recording; navigates to `/plans`. No purchase or billing change occurs by navigation alone. |

The hidden Website input is a honeypot, excluded from normal keyboard navigation; it is not a customer field. Browser autofill or extensions may affect it, but no such runtime behavior was tested. Labels and live regions exist in source; full keyboard, contrast, mobile and assistive-technology acceptance remains pending. [form-controls, form-submit, form-outcome]

## Read the outcome accurately

- **Confirmed recording:** the current client requires `accepted: true` and a nonempty string `referenceId`. It displays that reference and separately reports email `sent`, `failed` or `not configured`. Keep the reference. No response-time promise, customer entitlement, human review or completed resolution is implied.
- **Unconfirmed HTTP200:** missing/false acceptance or a missing/invalid reference does not establish recording. The current client preserves the message and shows unconfirmed-recording guidance instead of a success panel. Keep a private copy and ask support before submitting again.
- **Error or lost response:** the message remains in the component's form state. It is not a durable local draft: reload, closing or navigation can lose it. A failed acknowledgement does not prove that no server record or email exists. Do not automatically resend.
- **Rate limit:** the server's existing contact limiter returns429 before reading the body. It is an in-process ten-per-sixty-second sliding window keyed by selected IP header or fallback; this is not a distributed abuse-protection guarantee.

The tests use actual rendered client logic with synthetic response bodies. They verify the confirmation distinction, three email-status displays and error-message preservation without automatic resubmission. They do not prove real storage, inbox receipt or worker outcomes. The currently running0c9preview predates this confirmation patch. [form-submit, form-outcome, contact-entry, rate-limit, local-evidence]

## What the server actually records

The inspected handler normalizes/trims and caps fields, validates email, and for the ordinary form requires a message. A nonempty honeypot gets neutral HTTP200/acceptedfalse without creating a lead. Legacy free-review/cloud-health sources have distinct message defaults; they are not exposed as extra controls by this form. Caller-supplied source/topic strings are labels, not authorization. [contact-entry]

The message passes the existing pattern redactor before HTML escaping and storage. Other fields are normalized and escaped; this does not prove complete PII removal, all-secret detection or universal outbound filtering. Never rely on redaction to submit a secret. [contact-storage, redaction-shim, redaction-limits]

The handler separately creates a lead and a pending CONTACT_RESOLUTION job, then optionally requests two emails. These creates are not wrapped in one transaction in this handler, and no request idempotency key is present. A later failure can therefore return500 after a lead already exists. Preserve uncertainty; this guide does not repair or accept the backend's transaction/recovery behavior. [contact-storage, contact-mail]

`delivery: sent` is based on the internal email request's successful HTTP response; it is not inbox-delivery proof. The customer acknowledgement is attempted separately and does not determine that field. Missing mail configuration still permits a recorded response with `not_configured`. An email failure is not permission to duplicate a recorded request. [contact-mail]

The separate worker can select pending jobs and call a contact-resolution agent. A queued job or successful contact response is not evidence that this worker ran, that AI funding/admission is qualified, or that a human/agent resolved the issue. Full worker retry, financial and provider authority are outside this guide and remain open. [worker-boundary]

## Remaining acceptance

Actual form submission/delivery, storage failure/recovery, concurrency and duplicate requests, truthful worker resolution, tenant/privacy/retention review, authentic redacted media, browser/keyboard/AT, installed/released-version matching and genuine editorial/publication decisions remain unaccepted. No runtime route, email, provider, AI, customer database or credential was accessed while authoring this source draft. B4/B5 and all master parents remain open.
