import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataSourceBanner, ViewShell } from "../components/Primitives";
import { desktopClient } from "../lib/desktopClient";

interface ScanResult {
  provider: string;
  status: string;
  findings_count: number;
  cost_savings: number | null;
  security_issues: number;
  drift_detected: number;
  timestamp: string;
}

const SCAN_TYPES = [
  { id: "infrastructure", label: "Infrastructure Discovery", description: "Full resource inventory across your account", provider: "aws" },
  { id: "cost", label: "Cost Analysis", description: "Identify waste, right-size compute, optimize storage", provider: "aws" },
  { id: "security", label: "IAM Exposure Scan", description: "Flag overprivileged roles, unused keys, public access", provider: "aws" },
  { id: "s3", label: "S3 Public Bucket Scan", description: "Detect publicly accessible S3 buckets", provider: "aws" },
];

export function ScansView() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runScan = async (scanType: string, provider: string) => {
    setRunning(scanType);
    setError(null);

    try {
      const result = await invoke<ScanResult>("run_cloud_scan", {
        provider,
        scanType,
      });
      setResults((prev) => [result, ...prev]);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(null);
    }
  };

  return (
    <ViewShell>
      <DataSourceBanner
        mode={desktopClient.hasAuth() ? "authenticated_no_data" : "preview"}
        surfaceName="cloud scans"
        webPath="/dashboard/scans"
      />
      <div>
        <h1 className="text-xl font-bold tracking-tight">Cloud Scans</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Run read-only scans across your cloud infrastructure
        </p>
      </div>

      {/* Scan types */}
      <div className="grid grid-cols-2 gap-4 max-w-3xl">
        {SCAN_TYPES.map((scan) => (
          <button
            key={scan.id}
            onClick={() => runScan(scan.id, scan.provider)}
            disabled={running !== null}
            className="glass-card p-4 text-left hover:border-violet-500/30 transition-all group disabled:opacity-50"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                {scan.label}
              </span>
              {running === scan.id && (
                <span className="text-xs text-violet-400 animate-pulse">Running...</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">{scan.description}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 uppercase tracking-wider">
                {scan.provider}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
                Read-only
              </span>
            </div>
          </button>
        ))}
      </div>

      {error && (
        <div className="max-w-3xl p-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="max-w-3xl">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Scan Results</h2>
          <div className="space-y-3">
            {results.map((result, i) => (
              <div key={i} className="glass-card p-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-200">
                    {result.provider.toUpperCase()} Scan
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <span className="text-xs text-zinc-500">Findings</span>
                    <div className="text-lg font-bold text-violet-400">{result.findings_count}</div>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Savings</span>
                    <div className="text-lg font-bold text-emerald-400">
                      {result.cost_savings ? `$${result.cost_savings.toLocaleString()}/mo` : "--"}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Security</span>
                    <div className={`text-lg font-bold ${result.security_issues > 0 ? "text-red-400" : "text-zinc-400"}`}>
                      {result.security_issues}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Drift</span>
                    <div className={`text-lg font-bold ${result.drift_detected > 0 ? "text-amber-400" : "text-zinc-400"}`}>
                      {result.drift_detected}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !error && (
        <div className="max-w-3xl glass-card p-8 text-center">
          <p className="text-sm text-zinc-500">No scans run yet</p>
          <p className="text-xs text-zinc-600 mt-1">Select a scan type above to begin</p>
        </div>
      )}
    </ViewShell>
  );
}
