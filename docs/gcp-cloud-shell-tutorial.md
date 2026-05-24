# Connect GCP to Axiom Agent — Cloud Shell tutorial

This tutorial creates a read-only service account in your Google Cloud
project, binds `roles/iam.securityReviewer`, and emits the JSON key you
paste back into the VisionXIXLabs onboarding form.

You will not type any commands — the **Run** buttons execute the
prepared `gcloud` invocations in the Cloud Shell pane on the right.

## 1. Pick the project you want to connect

Replace `YOUR_PROJECT_ID` below with the GCP project id you want
Axiom Agent to scan, then run:

```bash
export PROJECT_ID=YOUR_PROJECT_ID
gcloud config set project "$PROJECT_ID"
```

## 2. Create the read-only service account

```bash
gcloud iam service-accounts create axiom-agent-reader \
  --display-name "Axiom Agent · read-only" \
  --description  "Used by VisionXIXLabs Axiom Agent for inventory + posture scans. Read-only."
```

## 3. Bind the security-reviewer role

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:axiom-agent-reader@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.securityReviewer"
```

## 4. Generate the JSON key

```bash
gcloud iam service-accounts keys create axiom-agent-key.json \
  --iam-account="axiom-agent-reader@${PROJECT_ID}.iam.gserviceaccount.com"
```

## 5. Display the key so you can copy it

```bash
cat axiom-agent-key.json
```

Copy the entire JSON output. Back on
[visionxixlabs.com/operator/onboarding](https://visionxixlabs.com/operator/onboarding),
paste it into the **Service Account JSON** field for GCP.

## 6. (Optional) Revoke any time

When you want to disconnect, just delete the service account:

```bash
gcloud iam service-accounts delete \
  "axiom-agent-reader@${PROJECT_ID}.iam.gserviceaccount.com"
```

That removes the role binding and immediately invalidates every key
issued from it. The platform receives `auth_failed` on its next
scan and the connector status flips to red.
