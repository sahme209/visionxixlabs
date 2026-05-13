use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Preferences {
    pub theme: String,
    pub notifications_enabled: bool,
    pub auto_scan_interval_minutes: u32,
    pub default_provider: String,
    pub scan_on_launch: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            notifications_enabled: true,
            auto_scan_interval_minutes: 60,
            default_provider: "aws".into(),
            scan_on_launch: false,
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
    };

    Ok(prefs)
}

#[tauri::command]
pub async fn set_preferences(app: tauri::AppHandle, prefs: Preferences) -> Result<(), String> {
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
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("api_endpoint", serde_json::json!(endpoint));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
