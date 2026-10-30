//! Metadata-only application activation. Native modals do not deactivate NSApplication.
#[cfg(target_os="macos")]
mod native {
 use std::sync::{OnceLock,atomic::{AtomicU64,Ordering}};
 use tauri::Emitter;
 static APP:OnceLock<tauri::AppHandle>=OnceLock::new();
 static SEQUENCE:AtomicU64=AtomicU64::new(0);
 extern "C" {fn axiom_application_focus_subscribe(callback:extern "C" fn(bool));}
 extern "C" fn changed(active:bool){
  if let Some(app)=APP.get(){let sequence=SEQUENCE.fetch_add(1,Ordering::SeqCst)+1;
   let _=app.emit_to("main","native-observation-application-focus",serde_json::json!({"sequence":sequence,"active":active}));
  }
 }
 pub fn subscribe(app:tauri::AppHandle){APP.get_or_init(||app);unsafe{axiom_application_focus_subscribe(changed)}}
}
#[tauri::command]
pub fn computer_observation_focus_subscribe(window:tauri::WebviewWindow,app:tauri::AppHandle)->Result<(),String>{
 if window.label()!="main"{return Err("native_observation_focus_unavailable".into())}
 #[cfg(target_os="macos")]{native::subscribe(app);Ok(())}
 #[cfg(not(target_os="macos"))]{let _=app;Err("native_observation_focus_unavailable".into())}
}
