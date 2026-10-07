/*!
 * Native application menu — primarily for macOS where a missing menubar
 * is jarring (no Cmd+Q, no Cmd+W, no app-name header). Windows + Linux
 * render the same menu inside the window when applicable, which adds
 * useful keyboard shortcuts without taking visual space on macOS.
 *
 * Approach: build standard predefined submenus (the OS knows what Edit
 * should contain — copy/paste/etc — and how to localize them) plus a
 * custom "Settings" item that focuses the main window and dispatches a
 * frontend event the SettingsView can subscribe to.
 *
 * The menu is intentionally minimal: every item maps to behavior already
 * reachable from the sidebar, so this only adds keyboard ergonomics, not
 * new surface area.
 */

use tauri::{
    menu::{AboutMetadata, Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, Runtime,
};

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let about_meta = AboutMetadata {
        name: Some("Axiom Agent".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        copyright: Some("© 2026 Vision XIX Labs".into()),
        website: Some("https://visionxixlabs.com".into()),
        website_label: Some("visionxixlabs.com".into()),
        ..Default::default()
    };

    // App menu (macOS only) — name comes from CFBundleName but the items
    // need to be defined here.
    let app_submenu = SubmenuBuilder::new(app, "Axiom Agent")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About Axiom Agent"),
            Some(about_meta.clone()),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "menu_open_settings",
            "Settings…",
            true,
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, Some("Services"))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Axiom Agent"))?)
        .build()?;

    // File menu — "Close window" wraps Cmd+W; on macOS the OS standard.
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    // Edit — standard OS clipboard items so text inputs in the webview
    // get Cmd+X/C/V/Z without us re-implementing anything.
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    // View — quick jump shortcuts to the most-used sidebar destinations.
    // These dispatch a frontend event the App component listens for.
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&MenuItem::with_id(
            app,
            "menu_view_agent",
            "Agent",
            true,
            Some("CmdOrCtrl+1"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "menu_view_deployment_requests",
            "Release workspace",
            true,
            Some("CmdOrCtrl+2"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "menu_view_repositories",
            "GitHub repositories",
            true,
            Some("CmdOrCtrl+3"),
        )?)
        .item(&MenuItem::with_id(app, "menu_view_docs", "Documentation", true, Some("CmdOrCtrl+4"))?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItem::with_id(
            app,
            "menu_help_docs",
            "Documentation",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "menu_help_homepage",
            "VisionXIXLabs",
            true,
            None::<&str>,
        )?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .item(&help_submenu)
        .build()
}

/// Frontend-bound event payload — the App component listens for
/// `menu://action` events and switches the active view accordingly.
const MENU_EVENT: &str = "menu://action";

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "menu_open_settings" => emit(app, "open_settings"),
        "menu_view_agent" => emit(app, "view:agent"),
        "menu_view_deployment_requests" => emit(app, "view:deployment-requests"),
        "menu_view_repositories" => emit(app, "view:repository-workspace"),
        "menu_view_docs" => emit(app, "view:docs"),
        "menu_help_docs" => open_url(app, "https://visionxixlabs.com/docs"),
        "menu_help_homepage" => open_url(app, "https://visionxixlabs.com"),
        _ => {}
    }
}

fn emit<R: Runtime>(app: &AppHandle<R>, payload: &str) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    let _ = app.emit(MENU_EVENT, payload.to_string());
}

fn open_url<R: Runtime>(app: &AppHandle<R>, url: &str) {
    // tauri_plugin_shell is already loaded; use its OS-open helper.
    use tauri_plugin_shell::ShellExt;
    let _ = app.shell().open(url, None);
}
