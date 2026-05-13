import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
}

interface HealthStatus {
  status: string;
  version: string;
  uptime_ms: number;
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "violet" | "amber" | "red";
}

function MetricCard({ label, value, sub, accent = "violet" }: MetricCardProps) {
  const colors = {
    emerald: "text-emerald-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };

  return (
    <div className="metric-card animate-fade-in">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={`text-2xl font-bold tracking-tight ${colors[accent]}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

export function DashboardView() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    invoke<SystemInfo>("get_system_info").then(setSystemInfo).catch(console.error);
    invoke<HealthStatus>("get_health").then(setHealth).catch(console.error);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Operations Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Cloud infrastructure intelligence at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {health && (
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="glow-dot bg-emerald-400" />
              {health.status}
            </span>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Resources scanned" value="--" sub="Run first scan" accent="violet" />
        <MetricCard label="Monthly savings" value="--" sub="Pending analysis" accent="emerald" />
        <MetricCard label="Security findings" value="--" sub="Not scanned" accent="red" />
        <MetricCard label="Drift detected" value="--" sub="Not scanned" accent="amber" />
      </div>

      {/* Provider status */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-4 text-zinc-300">Cloud Providers</h2>
        <div className="grid grid-cols-3 gap-4">
          {["AWS", "Azure", "GCP"].map((provider) => (
            <div key={provider} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/40 border border-zinc-700/30">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                provider === "AWS" ? "bg-orange-500/20 text-orange-400" :
                provider === "Azure" ? "bg-blue-500/20 text-blue-400" :
                "bg-red-500/20 text-red-400"
              }`}>
                {provider[0]}
              </div>
              <div>
                <div className="text-sm font-medium">{provider}</div>
                <div className="text-xs text-zinc-500">Not connected</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System info */}
      {systemInfo && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3 text-zinc-300">System</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-zinc-500 text-xs">Platform</span>
              <div className="font-mono text-zinc-300">{systemInfo.platform}</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Architecture</span>
              <div className="font-mono text-zinc-300">{systemInfo.arch}</div>
            </div>
            <div>
              <span className="text-zinc-500 text-xs">Version</span>
              <div className="font-mono text-zinc-300">{systemInfo.version}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-3 text-zinc-300">Recent Activity</h2>
        <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
          <div className="text-center">
            <p>No activity yet</p>
            <p className="text-xs mt-1">Connect a cloud provider to begin scanning</p>
          </div>
        </div>
      </div>
    </div>
  );
}
