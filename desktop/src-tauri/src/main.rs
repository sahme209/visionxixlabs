#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cloud;
mod config;

use tauri::Manager;

#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

#[tauri::command]
async fn get_health() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "status": "operational",
        "version": env!("CARGO_PKG_VERSION"),
        "uptime_ms": 0,
    }))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_health,
            cloud::validate_aws_credentials,
            cloud::validate_azure_credentials,
            cloud::validate_gcp_credentials,
            cloud::get_connector_status,
            cloud::run_cloud_scan,
            config::get_preferences,
            config::set_preferences,
            config::get_api_endpoint,
            config::set_api_endpoint,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running axiom agent");
}
