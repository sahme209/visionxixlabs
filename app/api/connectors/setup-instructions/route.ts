import { NextRequest, NextResponse } from "next/server";

const BROKER_ACCOUNT_ID = "590183704419";

function generateExternalId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "axiom-";
  for (let i = 0; i < 20; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const awsInstructions = (externalId: string) => ({
  provider: "aws",
  method: "cross-account-iam-role",
  externalId,
  steps: [
    {
      step: 1,
      title: "Create IAM Role",
      description: "Open the AWS IAM Console and create a new role with 'Another AWS account' as the trusted entity.",
      action: "Navigate to IAM → Roles → Create role → Another AWS account",
    },
    {
      step: 2,
      title: "Configure Trust Policy",
      description: "Enter the Axiom broker account ID and external ID to establish secure cross-account trust.",
      trustPolicy: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: `arn:aws:iam::${BROKER_ACCOUNT_ID}:root` },
            Action: "sts:AssumeRole",
            Condition: { StringEquals: { "sts:ExternalId": externalId } },
          },
        ],
      },
    },
    {
      step: 3,
      title: "Attach Read-Only Policy",
      description: "Attach the AWS-managed ReadOnlyAccess policy. Axiom never requires write permissions for scanning.",
      policy: "arn:aws:iam::aws:policy/ReadOnlyAccess",
    },
    {
      step: 4,
      title: "Copy Role ARN",
      description: "After creating the role, copy the Role ARN and paste it into Axiom to complete the connection.",
    },
  ],
  securityNotes: [
    "Read-only access — Axiom cannot modify your infrastructure",
    "External ID prevents confused-deputy attacks",
    "Revoke access instantly by deleting the IAM role",
    "All API calls are logged in your CloudTrail",
  ],
});

const azureInstructions = () => ({
  provider: "azure",
  method: "service-principal",
  steps: [
    {
      step: 1,
      title: "Register App in Azure AD",
      description: "Create a new app registration in Azure Active Directory for Axiom Agent.",
      action: "Navigate to Azure AD → App registrations → New registration",
      details: {
        name: "Axiom Agent (Read-Only)",
        supportedAccountTypes: "Single tenant",
        redirectUri: "Not required",
      },
    },
    {
      step: 2,
      title: "Create Client Secret",
      description: "Generate a client secret for the app registration. Set expiration to 6 months or 1 year.",
      action: "App registration → Certificates & secrets → New client secret",
      securityNote: "Copy the secret value immediately — it cannot be retrieved later.",
    },
    {
      step: 3,
      title: "Assign Reader Role",
      description: "Grant the service principal Reader access at the subscription level.",
      action: "Subscriptions → [Your Subscription] → Access control (IAM) → Add role assignment",
      details: {
        role: "Reader",
        assignTo: "Axiom Agent (Read-Only)",
        scope: "Subscription",
      },
    },
    {
      step: 4,
      title: "Enter Credentials in Axiom",
      description: "Provide the Tenant ID, Application (Client) ID, and Client Secret to complete the connection.",
      requiredFields: ["Tenant ID", "Application (Client) ID", "Client Secret", "Subscription ID"],
    },
  ],
  securityNotes: [
    "Reader role only — Axiom cannot modify your Azure resources",
    "Service principal scoped to a single subscription",
    "Revoke access by deleting the app registration or removing role assignment",
    "All access logged in Azure Activity Log and Azure AD sign-in logs",
  ],
});

const gcpInstructions = () => ({
  provider: "gcp",
  method: "service-account",
  steps: [
    {
      step: 1,
      title: "Create Service Account",
      description: "Create a dedicated service account for Axiom Agent in your GCP project.",
      action: "IAM & Admin → Service Accounts → Create Service Account",
      details: {
        name: "axiom-agent-readonly",
        description: "Axiom Agent read-only access for cloud intelligence",
      },
    },
    {
      step: 2,
      title: "Assign Viewer Role",
      description: "Grant the Viewer role at the project level. This provides read-only access to all resources.",
      action: "IAM & Admin → IAM → Grant Access",
      details: {
        role: "roles/viewer",
        additionalRoles: [
          "roles/iam.securityReviewer",
          "roles/cloudasset.viewer",
        ],
      },
    },
    {
      step: 3,
      title: "Create and Download Key",
      description: "Generate a JSON key file for the service account.",
      action: "Service Accounts → [axiom-agent-readonly] → Keys → Add Key → Create new key → JSON",
      securityNote: "Store this key securely. It provides access to your project resources.",
    },
    {
      step: 4,
      title: "Upload Key to Axiom",
      description: "Paste the contents of the JSON key file into Axiom to complete the connection.",
      requiredFields: ["Project ID", "Service Account Key (JSON)"],
    },
  ],
  securityNotes: [
    "Viewer role only — Axiom cannot modify your GCP resources",
    "Service account scoped to a single project",
    "Revoke access by disabling the service account or deleting the key",
    "All access logged in Cloud Audit Logs",
  ],
});

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");

  if (!provider || !["aws", "azure", "gcp"].includes(provider)) {
    return NextResponse.json(
      { error: "provider query parameter required: 'aws', 'azure', or 'gcp'" },
      { status: 400 },
    );
  }

  switch (provider) {
    case "aws":
      return NextResponse.json(awsInstructions(generateExternalId()));
    case "azure":
      return NextResponse.json(azureInstructions());
    case "gcp":
      return NextResponse.json(gcpInstructions());
    default:
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
}
