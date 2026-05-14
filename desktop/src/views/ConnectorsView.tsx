import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ViewShell } from "../components/Primitives";

type Provider = "aws" | "azure" | "gcp";

interface ProviderConfig {
  id: Provider;
  name: string;
  color: string;
  bgColor: string;
  fields: { key: string; label: string; placeholder: string; sensitive?: boolean }[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "aws",
    name: "Amazon Web Services",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    fields: [
      { key: "role_arn", label: "IAM Role ARN", placeholder: "arn:aws:iam::123456789012:role/AxiomReadOnly" },
      { key: "external_id", label: "External ID", placeholder: "Auto-generated on connection" },
    ],
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    fields: [
      { key: "tenant_id", label: "Tenant ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "client_id", label: "Application (Client) ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "client_secret", label: "Client Secret", placeholder: "Enter client secret", sensitive: true },
    ],
  },
  {
    id: "gcp",
    name: "Google Cloud Platform",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    fields: [
      { key: "project_id", label: "Project ID", placeholder: "my-project-123456" },
      { key: "service_account_key", label: "Service Account Key (JSON)", placeholder: "Paste JSON key contents", sensitive: true },
    ],
  },
];

export function ConnectorsView() {
  const [selectedProvider, setSelectedProvider] = useState<Provider>("aws");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const provider = PROVIDERS.find((p) => p.id === selectedProvider)!;

  const handleConnect = async () => {
    setConnecting(true);
    setStatus(null);

    try {
      if (selectedProvider === "aws") {
        await invoke("validate_aws_credentials", {
          roleArn: formValues.role_arn || "",
          externalId: formValues.external_id || "",
        });
      } else if (selectedProvider === "azure") {
        await invoke("validate_azure_credentials", {
          tenantId: formValues.tenant_id || "",
          clientId: formValues.client_id || "",
          clientSecret: formValues.client_secret || "",
        });
      } else {
        await invoke("validate_gcp_credentials", {
          projectId: formValues.project_id || "",
          serviceAccountKey: formValues.service_account_key || "",
        });
      }
      setStatus({ type: "success", message: `${provider.name} connected successfully` });
    } catch (err) {
      setStatus({ type: "error", message: String(err) });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cloud Connectors</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Link cloud accounts using read-only access. Zero stored credentials.
        </p>
      </div>

      {/* Provider tabs */}
      <div className="flex gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProvider(p.id);
              setFormValues({});
              setStatus(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedProvider === p.id
                ? `${p.bgColor} ${p.color} border border-current/20`
                : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
            }`}
          >
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Connection form */}
      <div className="glass-card p-6 max-w-2xl">
        <h2 className={`text-lg font-semibold mb-1 ${provider.color}`}>{provider.name}</h2>
        <p className="text-xs text-zinc-500 mb-6">
          {selectedProvider === "aws"
            ? "We use cross-account IAM role assumption. No access keys stored."
            : selectedProvider === "azure"
            ? "Service principal with Reader role. Credentials validated and encrypted."
            : "Service account with Viewer role. Key validated and encrypted."}
        </p>

        <div className="space-y-4">
          {provider.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                {field.label}
              </label>
              {field.key === "service_account_key" ? (
                <textarea
                  rows={6}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 resize-none"
                />
              ) : (
                <input
                  type={field.sensitive ? "password" : "text"}
                  placeholder={field.placeholder}
                  value={formValues[field.key] || ""}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
                />
              )}
            </div>
          ))}
        </div>

        {status && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              status.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {status.message}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-6 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? "Validating..." : "Connect"}
        </button>
      </div>

      {/* Security note */}
      <div className="max-w-2xl p-4 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
        <div className="flex items-start gap-3">
          <svg className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v.01M12 12V8m0 12a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />
          </svg>
          <div className="text-xs text-zinc-400 space-y-1">
            <p className="font-medium text-zinc-300">Security model</p>
            <p>Credentials are validated locally, encrypted in transit, and never stored in plaintext. Revoke access anytime from your cloud provider console.</p>
          </div>
        </div>
      </div>
    </ViewShell>
  );
}
