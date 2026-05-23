#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cloud;
mod config;
mod menu;
mod tray;
mod window_state;

use tauri::{Manager, WindowEvent};

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
            tray::set_tray_badge,
            tray::set_tray_pending_list,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            window.open_devtools();

            // Tray icon — best-effort. A failed tray build (e.g. on a
            // headless CI machine) should not block the app from starting.
            if let Err(err) = tray::build(app.handle()) {
                eprintln!("axiom: tray init failed: {err}");
            }

            // Native app menu (macOS menubar + cross-platform shortcuts).
            // Failures here are also best-effort — without a menu the app
            // still works, you just lose Cmd+1/2/3 quick-jumps.
            match menu::build(app.handle()) {
                Ok(menu_handle) => {
                    if let Err(err) = app.set_menu(menu_handle) {
                        eprintln!("axiom: set_menu failed: {err}");
                    }
                }
                Err(err) => eprintln!("axiom: menu build failed: {err}"),
            }
            app.on_menu_event(|app_handle, event| {
                menu::handle_menu_event(app_handle, event.id.as_ref());
            });

            // Window state — restore size/position before any window paint,
            // then attach listeners so future resize/move/close calls
            // persist the new geometry.
            window_state::restore(app.handle());
            window_state::attach_listeners(app.handle());

            // Hide-to-tray on close: intercept the main window's red-X /
            // Cmd+W. The app stays alive in the menubar so the ambient
            // poller can keep firing approval notifications without the
            // window visible. Quit is still reachable from the tray menu
            // ("Quit"), the App menu ("Quit Axiom Agent" — Cmd+Q), or
            // the OS Force Quit panel.
            if let Some(main_window) = app.get_webview_window("main") {
                let handle_for_close = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = handle_for_close.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running axiom agent");
}
