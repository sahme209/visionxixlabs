import { invoke } from "@tauri-apps/api/core";

export interface DesktopPreferences {
  theme: "dark";
  notifications_enabled: boolean;
  auto_scan_interval_minutes: number;
  default_provider: string;
  scan_on_launch: boolean;
  interface_density: "comfortable" | "compact";
  reduce_motion: boolean;
  high_contrast: boolean;
  hide_email: boolean;
  new_message_behavior: "queue" | "interrupt";
  review_provider: "github" | "origin";
  pr_link_destination: "browser" | "inside_app";
  commit_attribution: boolean;
  pr_attribution: boolean;
  branch_prefix: string;
  max_worktrees: number;
  max_worktree_size_gb: number;
}

export function applyDesktopPreferences(preferences: DesktopPreferences) {
  const root = document.documentElement;
  root.dataset.density = preferences.interface_density;
  root.dataset.reduceMotion = preferences.reduce_motion ? "true" : "false";
  root.dataset.highContrast = preferences.high_contrast ? "true" : "false";
}

export async function readDesktopPreferences(): Promise<DesktopPreferences> {
  const preferences = await invoke<DesktopPreferences>("get_preferences");
  applyDesktopPreferences(preferences);
  return preferences;
}

export async function writeDesktopPreferences(preferences: DesktopPreferences): Promise<void> {
  await invoke("set_preferences", { prefs: preferences });
  applyDesktopPreferences(preferences);
}
