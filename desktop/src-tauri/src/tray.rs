/*!
 * System tray — Axiom Agent menubar surface.
 *
 * Owns the long-lived TrayIcon attached to the main app. Three responsibilities:
 *   1. Render a menu (Show window · pending-runs submenu · Quit) so the user
 *      can summon the app or jump to a specific pending approval without
 *      needing the main window open.
 *   2. Surface the count of pipeline runs currently awaiting approval as a
 *      menubar badge — the macOS title ("· 3" next to the icon) and the
 *      tooltip both reflect the same number. Webview calls
 *      `set_tray_badge(n)` after each Approvals poll.
 *   3. Rebuild the "Pending approvals" submenu in place when the webview
 *      pushes a new list via `set_tray_pending_list`. Tauri's TrayIcon
 *      supports menu replacement (`set_menu`), so we mint a fresh Menu
 *      every refresh — simpler than mutating items in place, and the
 *      submenu rebuild is rare (one per 15s ambient tick).
 *
 * Cross-platform notes:
 *   - macOS: `set_title` renders text alongside the menubar icon.
 *   - Windows: title is ignored; the tooltip carries the count instead.
 *   - Linux: same as Windows — tooltip-only.
 *
 * We set BOTH on every update so every OS shows the right thing.
 */

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

const TRAY_ID: &str = "axiom_main_tray";
const MENU_ID_SHOW: &str = "tray_show";
const MENU_ID_QUIT: &str = "tray_quit";
const MENU_ID_PENDING_PREFIX: &str = "tray_pending:";
const MENU_ID_APPROVE_PREFIX: &str = "tray_approve:";
const MENU_ID_REJECT_PREFIX: &str = "tray_reject:";

/// Mirror of the run rows the frontend pushes via `set_tray_pending_list`.
#[derive(Debug, Deserialize, Clone)]
pub struct PendingRunSummary {
    pub id: String,
    pub pipeline_id: String,
    pub triggered_by: String,
}

/// Emitted on `tray://decide` when the user picks Approve/Reject from
/// the tray submenu. Frontend listens, calls v1DecideApproval, then
/// fires a result notification.
#[derive(Debug, Serialize, Clone)]
pub struct TrayDecisionRequest {
    pub run_id: String,
    pub decision: &'static str, // "approved" | "rejected"
}

/// Cache the last set of pending runs so the tray icon-click path
/// (which mints a fresh menu on demand) shows current state without an
/// extra IPC round-trip from the frontend.
static PENDING_CACHE: Mutex<Vec<PendingRunSummary>> = Mutex::new(Vec::new());

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    } else {
        // The tray is an enhancement, not a launch prerequisite. Some
        // platform packaging paths can omit the default window icon.
        eprintln!("axiom: tray disabled because no default window icon is available");
        return Ok(());
    }

    builder
        .icon_as_template(true) // macOS template icon — adapts to light/dark menubar.
        .tooltip("Axiom Agent")
        .menu(&build_menu(app, &[])?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            if id == MENU_ID_SHOW {
                focus_main_window(app);
            } else if id == MENU_ID_QUIT {
                app.exit(0);
            } else if let Some(run_id) = id.strip_prefix(MENU_ID_APPROVE_PREFIX) {
                let _ = app.emit(
                    "tray://decide",
                    TrayDecisionRequest {
                        run_id: run_id.to_string(),
                        decision: "approved",
                    },
                );
            } else if let Some(run_id) = id.strip_prefix(MENU_ID_REJECT_PREFIX) {
                let _ = app.emit(
                    "tray://decide",
                    TrayDecisionRequest {
                        run_id: run_id.to_string(),
                        decision: "rejected",
                    },
                );
            } else if let Some(run_id) = id.strip_prefix(MENU_ID_PENDING_PREFIX) {
                // Plain "Open in window" item — jump to the Approvals view
                // and emit a hint event so the row is scrolled + highlighted.
                focus_main_window(app);
                let _ = app.emit("menu://action", "view:approvals".to_string());
                let _ = app.emit("tray://pending-selected", run_id.to_string());
            }
        })
        .on_tray_icon_event(|tray, event| {
            // Left click reveals the window — matches macOS Slack/Linear behavior.
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                focus_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Build the tray's menu from a snapshot of pending runs. Returns a fresh
/// Menu each call — the caller assigns it via `tray.set_menu(Some(menu))`.
/// Truncated to MAX_PENDING_ITEMS to keep the menu visually manageable.
fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    pending: &[PendingRunSummary],
) -> tauri::Result<Menu<R>> {
    const MAX_PENDING_ITEMS: usize = 5;
    let show = MenuItem::with_id(app, MENU_ID_SHOW, "Show Axiom Agent", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_ID_QUIT, "Quit", true, None::<&str>)?;

    let pending_submenu = build_pending_submenu(app, pending, MAX_PENDING_ITEMS)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let items: Vec<&dyn IsMenuItem<R>> = vec![&show, &pending_submenu, &separator, &quit];
    Menu::with_items(app, &items)
}

fn build_pending_submenu<R: Runtime>(
    app: &AppHandle<R>,
    pending: &[PendingRunSummary],
    max_items: usize,
) -> tauri::Result<Submenu<R>> {
    let label = if pending.is_empty() {
        "Pending approvals (none)".to_string()
    } else if pending.len() == 1 {
        "Pending approvals (1)".to_string()
    } else {
        format!("Pending approvals ({})", pending.len())
    };

    let mut builder = SubmenuBuilder::new(app, label);

    if pending.is_empty() {
        let none = MenuItem::with_id(
            app,
            "tray_pending_none",
            "No runs awaiting review",
            false,
            None::<&str>,
        )?;
        builder = builder.item(&none);
        return builder.build();
    }

    for run in pending.iter().take(max_items) {
        // Each run row becomes a nested submenu:
        //   Pipeline · runId…
        //     ├── ✓ Approve  (tray_approve:<runId>)
        //     ├── ✗ Reject   (tray_reject:<runId>)
        //     ├── ─────────
        //     └── Open in window  (tray_pending:<runId>)
        // This is the quick-approve killer feature: cast a vote without
        // ever showing the window. Pipeline gates default to two-person
        // quorum so one tray click never single-handedly tips a gate.
        let short_id = run.id.chars().take(10).collect::<String>();
        let triggered_short = run.triggered_by.chars().take(20).collect::<String>();
        let label = format!("{} · {}…", run.pipeline_id, short_id);

        let approve_id = format!("{MENU_ID_APPROVE_PREFIX}{}", run.id);
        let reject_id = format!("{MENU_ID_REJECT_PREFIX}{}", run.id);
        let open_id = format!("{MENU_ID_PENDING_PREFIX}{}", run.id);

        let approve = MenuItem::with_id(app, &approve_id, "✓ Approve", true, None::<&str>)?;
        let reject = MenuItem::with_id(app, &reject_id, "✗ Reject", true, None::<&str>)?;
        let sep = PredefinedMenuItem::separator(app)?;
        let open = MenuItem::with_id(app, &open_id, "Open in window", true, None::<&str>)?;
        // Per-run disabled-header item — id has to be unique within the
        // menu, so it's namespaced with the runId rather than a constant.
        let triggered_id = format!("tray_triggered_disabled:{}", run.id);
        let triggered = MenuItem::with_id(
            app,
            &triggered_id,
            format!("by {triggered_short}"),
            false,
            None::<&str>,
        )?;

        let nested = SubmenuBuilder::new(app, label)
            .item(&triggered)
            .item(&PredefinedMenuItem::separator(app)?)
            .item(&approve)
            .item(&reject)
            .item(&sep)
            .item(&open)
            .build()?;
        builder = builder.item(&nested);
    }
    if pending.len() > max_items {
        let extra = pending.len() - max_items;
        let footer_label = format!("+{extra} more in the Approvals view");
        let footer =
            MenuItem::with_id(app, "tray_pending_more", footer_label, false, None::<&str>)?;
        builder = builder.item(&footer);
    }
    builder.build()
}

/// Update the menubar badge to reflect the current count of pipeline runs
/// awaiting approval. Idempotent — calling with the same count is a no-op
/// at the OS level, so the Approvals view can fire this every 5s without
/// worrying about flicker.
#[tauri::command]
pub fn set_tray_badge<R: Runtime>(app: AppHandle<R>, count: u32) -> Result<(), String> {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };

    let title = if count == 0 {
        None
    } else {
        Some(count.to_string())
    };
    let tooltip = if count == 0 {
        "Axiom Agent".to_string()
    } else if count == 1 {
        "Axiom Agent · 1 approval pending".to_string()
    } else {
        format!("Axiom Agent · {count} approvals pending")
    };

    let _ = tray.set_title(title);
    let _ = tray.set_tooltip(Some(tooltip));
    Ok(())
}

/// Replace the tray's pending-approvals submenu with a fresh snapshot.
/// The frontend calls this from the ambient watcher after every poll so
/// the menu stays current even when the main window is hidden.
#[tauri::command]
pub fn set_tray_pending_list<R: Runtime>(
    app: AppHandle<R>,
    pending: Vec<PendingRunSummary>,
) -> Result<(), String> {
    if let Ok(mut cache) = PENDING_CACHE.lock() {
        *cache = pending.clone();
    }
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    match build_menu(&app, &pending) {
        Ok(menu) => {
            let _ = tray.set_menu(Some(menu));
            Ok(())
        }
        Err(err) => Err(err.to_string()),
    }
}
