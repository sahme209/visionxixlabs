use serde_json::Value;
use tauri_plugin_store::StoreExt;

const SERVICE: &str = "com.visionxixlabs.axiom";
const LEGACY_STORE: &str = "axiom-desktop.dat";

fn entry(key: &str) -> Result<keyring::Entry, String> {
    if key.trim().is_empty() {
        return Err("Secure-storage key cannot be empty.".to_string());
    }
    keyring::Entry::new(SERVICE, key).map_err(|_| "Secure storage is unavailable.".to_string())
}

fn read_keyring_value(key: &str) -> Result<Option<Value>, String> {
    match entry(key)?.get_password() {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|_| "A secure-storage value is corrupted.".to_string()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Secure storage could not be read.".to_string()),
    }
}

fn write_keyring_value(key: &str, value: &Value) -> Result<(), String> {
    let raw = serde_json::to_string(value)
        .map_err(|_| "Secure-storage value could not be encoded.".to_string())?;
    entry(key)?
        .set_password(&raw)
        .map_err(|_| "Secure storage could not be updated.".to_string())
}

/// Read a value from the OS credential vault. Existing 0.1.x installs are
/// migrated once from the old JSON store, then the plaintext copy is removed.
pub(crate) fn read_value(app: &tauri::AppHandle, key: &str) -> Result<Option<Value>, String> {
    if let Some(value) = read_keyring_value(key)? {
        return Ok(Some(value));
    }

    let store = app
        .store(LEGACY_STORE)
        .map_err(|_| "Legacy storage could not be opened.".to_string())?;
    let Some(value) = store.get(key) else {
        return Ok(None);
    };

    write_keyring_value(key, &value)?;
    store.delete(key);
    store
        .save()
        .map_err(|_| "Legacy credential cleanup failed.".to_string())?;
    Ok(Some(value))
}

pub(crate) fn read_string(app: &tauri::AppHandle, key: &str) -> Result<Option<String>, String> {
    Ok(read_value(app, key)?.and_then(|value| value.as_str().map(ToOwned::to_owned)))
}

#[tauri::command]
pub async fn read_secure_value(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<Value>, String> {
    read_value(&app, &key)
}

#[tauri::command]
pub async fn write_secure_value(key: String, value: Value) -> Result<(), String> {
    write_keyring_value(&key, &value)
}

#[tauri::command]
pub async fn delete_secure_value(app: tauri::AppHandle, key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(_) => return Err("Secure storage could not be cleared.".to_string()),
    }

    // Also remove a pre-0.1.8 plaintext copy if it still exists.
    let store = app
        .store(LEGACY_STORE)
        .map_err(|_| "Legacy storage could not be opened.".to_string())?;
    store.delete(&key);
    store
        .save()
        .map_err(|_| "Legacy credential cleanup failed.".to_string())
}
