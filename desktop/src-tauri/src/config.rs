use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    pub theme: String,
    pub notifications_enabled: bool,
    pub auto_scan_interval_minutes: u32,
    pub default_provider: String,
    pub scan_on_launch: bool,
    pub interface_density: String,
    pub reduce_motion: bool,
    pub high_contrast: bool,
    pub hide_email: bool,
    pub new_message_behavior: String,
    pub review_provider: String,
    pub pr_link_destination: String,
    pub commit_attribution: bool,
    pub pr_attribution: bool,
    pub branch_prefix: String,
    pub max_worktrees: u32,
    pub max_worktree_size_gb: u32,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            notifications_enabled: true,
            auto_scan_interval_minutes: 60,
            default_provider: "aws".into(),
            scan_on_launch: false,
            interface_density: "comfortable".into(),
            reduce_motion: false,
            high_contrast: false,
            hide_email: false,
            new_message_behavior: "queue".into(),
            review_provider: "github".into(),
            pr_link_destination: "browser".into(),
            commit_attribution: true,
            pr_attribution: true,
            branch_prefix: "axiom/".into(),
            max_worktrees: 25,
            max_worktree_size_gb: 50,
        }
    }
}

#[tauri::command]
pub async fn get_preferences(app: tauri::AppHandle) -> Result<Preferences, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;

    let prefs = Preferences {
        theme: store
            .get("theme")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "dark".into()),
        notifications_enabled: store
            .get("notifications_enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        auto_scan_interval_minutes: store
            .get("auto_scan_interval_minutes")
            .and_then(|v| v.as_u64())
            .unwrap_or(60) as u32,
        default_provider: store
            .get("default_provider")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "aws".into()),
        scan_on_launch: store
            .get("scan_on_launch")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        interface_density: store
            .get("interface_density")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "comfortable".into()),
        reduce_motion: store.get("reduce_motion").and_then(|v| v.as_bool()).unwrap_or(false),
        high_contrast: store.get("high_contrast").and_then(|v| v.as_bool()).unwrap_or(false),
        hide_email: store.get("hide_email").and_then(|v| v.as_bool()).unwrap_or(false),
        new_message_behavior: store
            .get("new_message_behavior")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "queue".into()),
        review_provider: store
            .get("review_provider")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "github".into()),
        pr_link_destination: store
            .get("pr_link_destination")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "browser".into()),
        commit_attribution: store.get("commit_attribution").and_then(|v| v.as_bool()).unwrap_or(true),
        pr_attribution: store.get("pr_attribution").and_then(|v| v.as_bool()).unwrap_or(true),
        branch_prefix: store
            .get("branch_prefix")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or_else(|| "axiom/".into()),
        max_worktrees: store.get("max_worktrees").and_then(|v| v.as_u64()).unwrap_or(25) as u32,
        max_worktree_size_gb: store.get("max_worktree_size_gb").and_then(|v| v.as_u64()).unwrap_or(50) as u32,
    };

    Ok(prefs)
}

#[tauri::command]
pub async fn set_preferences(app: tauri::AppHandle, prefs: Preferences) -> Result<(), String> {
    if prefs.theme != "dark" {
        return Err("Only the dark theme is supported in this release.".to_string());
    }
    if ![15, 30, 60, 360, 1440].contains(&prefs.auto_scan_interval_minutes) {
        return Err("Auto-scan interval must be one of the supported values.".to_string());
    }
    if !["aws", "azure", "gcp"].contains(&prefs.default_provider.as_str()) {
        return Err("Default provider must be AWS, Azure, or GCP.".to_string());
    }
    if !["comfortable", "compact"].contains(&prefs.interface_density.as_str()) {
        return Err("Interface density must be comfortable or compact.".to_string());
    }
    if !["queue", "interrupt"].contains(&prefs.new_message_behavior.as_str()) {
        return Err("New-message behavior must be queue or interrupt.".to_string());
    }
    if !["github", "origin"].contains(&prefs.review_provider.as_str()) {
        return Err("Review provider must be GitHub or Origin.".to_string());
    }
    if !["browser", "inside_app"].contains(&prefs.pr_link_destination.as_str()) {
        return Err("PR link destination must be browser or inside_app.".to_string());
    }
    if prefs.branch_prefix.len() > 64 || prefs.branch_prefix.chars().any(char::is_whitespace) {
        return Err("Branch prefix must be 64 characters or fewer and contain no spaces.".to_string());
    }
    if !(1..=100).contains(&prefs.max_worktrees) || !(1..=500).contains(&prefs.max_worktree_size_gb) {
        return Err("Worktree limits are outside the supported range.".to_string());
    }
    let store = app.store("config.json").map_err(|e| e.to_string())?;

    store.set("theme", serde_json::json!(prefs.theme));
    store.set(
        "notifications_enabled",
        serde_json::json!(prefs.notifications_enabled),
    );
    store.set(
        "auto_scan_interval_minutes",
        serde_json::json!(prefs.auto_scan_interval_minutes),
    );
    store.set(
        "default_provider",
        serde_json::json!(prefs.default_provider),
    );
    store.set("scan_on_launch", serde_json::json!(prefs.scan_on_launch));
    store.set("interface_density", serde_json::json!(prefs.interface_density));
    store.set("reduce_motion", serde_json::json!(prefs.reduce_motion));
    store.set("high_contrast", serde_json::json!(prefs.high_contrast));
    store.set("hide_email", serde_json::json!(prefs.hide_email));
    store.set("new_message_behavior", serde_json::json!(prefs.new_message_behavior));
    store.set("review_provider", serde_json::json!(prefs.review_provider));
    store.set("pr_link_destination", serde_json::json!(prefs.pr_link_destination));
    store.set("commit_attribution", serde_json::json!(prefs.commit_attribution));
    store.set("pr_attribution", serde_json::json!(prefs.pr_attribution));
    store.set("branch_prefix", serde_json::json!(prefs.branch_prefix));
    store.set("max_worktrees", serde_json::json!(prefs.max_worktrees));
    store.set("max_worktree_size_gb", serde_json::json!(prefs.max_worktree_size_gb));

    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_api_endpoint(app: tauri::AppHandle) -> Result<String, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;

    Ok(store
        .get("api_endpoint")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "https://visionxixlabs.com".to_string()))
}

#[tauri::command]
pub async fn set_api_endpoint(app: tauri::AppHandle, endpoint: String) -> Result<(), String> {
    let endpoint = normalize_api_endpoint(&endpoint)?;
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("api_endpoint", serde_json::json!(endpoint));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_api_endpoint(input: &str) -> Result<String, String> {
    let trimmed = input.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(trimmed)
        .map_err(|_| "API endpoint must be a valid URL.".to_string())?;
    let is_loopback = matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
    if parsed.scheme() != "https"
        && !(cfg!(debug_assertions) && is_loopback && parsed.scheme() == "http")
    {
        return Err(
            "API endpoint must use HTTPS (HTTP is allowed only for local development).".to_string(),
        );
    }
    if parsed.username() != ""
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("API endpoint cannot contain credentials, a query, or a fragment.".to_string());
    }
    if parsed.path() != "/" && !parsed.path().is_empty() {
        return Err("API endpoint must be an origin without a path.".to_string());
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::normalize_api_endpoint;

    #[test]
    fn accepts_and_normalizes_https_origin() {
        assert_eq!(
            normalize_api_endpoint(" https://visionxixlabs.com/ ").unwrap(),
            "https://visionxixlabs.com"
        );
    }

    #[test]
    fn rejects_insecure_remote_and_embedded_credentials() {
        assert!(normalize_api_endpoint("http://example.com").is_err());
        assert!(normalize_api_endpoint("https://user:pass@example.com").is_err());
    }

    #[test]
    fn rejects_paths_queries_and_malformed_urls() {
        assert!(normalize_api_endpoint("https://example.com/api").is_err());
        assert!(normalize_api_endpoint("https://example.com?tenant=x").is_err());
        assert!(normalize_api_endpoint("not a url").is_err());
    }
}
