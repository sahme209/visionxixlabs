/*!
 * Window state persistence.
 *
 * Restores the main window's size + position from a tiny JSON store
 * on startup, and writes the current size + position back on resize,
 * move, and close. Uses the already-loaded `tauri-plugin-store` rather
 * than pulling in `tauri-plugin-window-state` as a new dependency.
 *
 * Behavior:
 *   - First launch: no stored state → window opens at the tauri.conf.json
 *     defaults (1280×800, OS-chosen position).
 *   - Subsequent launches: stored state applies before the window is
 *     shown so there's no flicker from default → restored size.
 *   - Off-screen guard: if the stored position would land the window
 *     outside the current monitor layout (e.g. a previously-attached
 *     external monitor is gone), we drop the position back to OS default
 *     and keep just the size.
 *   - Best-effort: any error in load/save is logged to stderr and
 *     swallowed so a corrupted store file never blocks startup.
 */

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime,
    WindowEvent,
};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "window-state.json";
const STORE_KEY: &str = "main_window";
const MIN_USABLE_DIM: f64 = 200.0; // smaller than the configured min — defensive.

#[derive(Debug, Serialize, Deserialize, Clone, Copy)]
struct PersistedWindowState {
    width: f64,
    height: f64,
    x: Option<f64>,
    y: Option<f64>,
    maximized: bool,
}

pub fn restore<R: Runtime>(app: &AppHandle<R>) {
    let store = match app.store(STORE_FILE) {
        Ok(s) => s,
        Err(err) => {
            eprintln!("axiom: window state store open failed: {err}");
            return;
        }
    };
    let Some(value) = store.get(STORE_KEY) else { return; };
    let Ok(state) = serde_json::from_value::<PersistedWindowState>(value) else { return; };

    let Some(window) = app.get_webview_window("main") else { return; };

    // Apply size first — almost always safe.
    if state.width >= MIN_USABLE_DIM && state.height >= MIN_USABLE_DIM {
        let _ = window.set_size(LogicalSize::new(state.width, state.height));
    }

    // Apply position only if it falls inside one of the currently-attached
    // monitors. Otherwise leave it at the OS-chosen default so the window
    // doesn't end up off-screen on a now-disconnected monitor.
    if let (Some(x), Some(y)) = (state.x, state.y) {
        if position_visible(&window, x, y) {
            let _ = window.set_position(LogicalPosition::new(x, y));
        }
    }

    if state.maximized {
        let _ = window.maximize();
    }
}

fn position_visible<R: Runtime>(window: &tauri::WebviewWindow<R>, x: f64, y: f64) -> bool {
    let Ok(monitors) = window.available_monitors() else { return true; };
    if monitors.is_empty() { return true; }
    for m in monitors.iter() {
        let pos = m.position();
        let size = m.size();
        let scale = m.scale_factor();
        // Convert monitor rect to logical coords to compare against our
        // logical x/y. (Tauri reports both in physical pixels.)
        let mx = pos.x as f64 / scale;
        let my = pos.y as f64 / scale;
        let mw = size.width as f64 / scale;
        let mh = size.height as f64 / scale;
        // Allow a 32px buffer — even a partially-visible window is recoverable.
        if x + 32.0 >= mx && y + 32.0 >= my && x < mx + mw - 32.0 && y < my + mh - 32.0 {
            return true;
        }
    }
    false
}

/// Attach resize/move/close listeners that persist the latest geometry.
/// Returns immediately if the main window isn't yet attached. AppHandle
/// is cheap-Clone (internally Arc'd), so the closure captures its own
/// clone without any extra synchronization.
pub fn attach_listeners<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else { return; };
    let handle_for_listener = app.clone();

    window.on_window_event(move |event| {
        let needs_persist = matches!(
            event,
            WindowEvent::Resized(_) | WindowEvent::Moved(_) | WindowEvent::CloseRequested { .. },
        );
        if !needs_persist { return; }
        let Some(w) = handle_for_listener.get_webview_window("main") else { return; };
        let Ok(size)  = w.outer_size()     else { return; };
        let Ok(pos)   = w.outer_position() else { return; };
        let Ok(scale) = w.scale_factor()   else { return; };
        let maximized = w.is_maximized().unwrap_or(false);
        persist_state(&handle_for_listener, size, pos, scale, maximized);
    });
}

fn persist_state<R: Runtime>(
    app: &AppHandle<R>,
    size: PhysicalSize<u32>,
    pos: PhysicalPosition<i32>,
    scale: f64,
    maximized: bool,
) {
    let logical_w = size.width as f64 / scale;
    let logical_h = size.height as f64 / scale;
    let logical_x = pos.x as f64 / scale;
    let logical_y = pos.y as f64 / scale;
    let state = PersistedWindowState {
        width: logical_w,
        height: logical_h,
        x: Some(logical_x),
        y: Some(logical_y),
        maximized,
    };
    let Ok(store) = app.store(STORE_FILE) else { return; };
    if let Ok(value) = serde_json::to_value(state) {
        store.set(STORE_KEY, value);
        // Best-effort flush — a missed save just means we lose this frame
        // of geometry, never a crash.
        let _ = store.save();
    }
}
