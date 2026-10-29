import { invoke } from "@tauri-apps/api/core";

export interface DesktopPreferences {
  theme: "dark" | "light" | "system";
  submit_with_command_enter: boolean;
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

let removeThemeListener: (() => void) | undefined;

export function applyDesktopPreferences(preferences: DesktopPreferences) {
  const root = document.documentElement;
  removeThemeListener?.();
  removeThemeListener = undefined;
  if (preferences.theme === "system" && typeof window.matchMedia === "function") {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let active = true;
    const update = (matches: boolean) => { if (active) { root.dataset.theme = matches ? "dark" : "light"; root.style.colorScheme = root.dataset.theme; } };
    update(media.matches);
    const listener = (event: MediaQueryListEvent) => update(event.matches);
    media.addEventListener("change", listener);
    removeThemeListener = () => { active = false; media.removeEventListener("change", listener); };
  } else {
    root.dataset.theme = preferences.theme === "light" ? "light" : "dark";
    root.style.colorScheme = root.dataset.theme;
  }
  root.dataset.density = preferences.interface_density;
  root.dataset.reduceMotion = preferences.reduce_motion ? "true" : "false";
  root.dataset.highContrast = preferences.high_contrast ? "true" : "false";
}

// A Settings view can unmount while native storage is settling. Keep ordering
// here, across views, so a reopened editor cannot read ahead of a pending save.
let pendingPreferenceWrite: Promise<void> = Promise.resolve();

export async function readDesktopPreferences(): Promise<DesktopPreferences> {
  await pendingPreferenceWrite.catch(() => undefined);
  const preferences = await invoke<DesktopPreferences>("get_preferences");
  applyDesktopPreferences(preferences);
  return preferences;
}

export async function writeDesktopPreferences(preferences: DesktopPreferences): Promise<void> {
  const write = pendingPreferenceWrite.catch(() => undefined).then(async () => {
    await invoke("set_preferences", { prefs: preferences });
    applyDesktopPreferences(preferences);
    window.dispatchEvent(new Event("axiom:preferences-changed"));
  });
  pendingPreferenceWrite = write;
  await write;
}
