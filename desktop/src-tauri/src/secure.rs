use serde_json::Value;
use tauri_plugin_store::StoreExt;

#[cfg(test)]
const SERVICE: &str = "com.visionxixlabs.axiom";
const LEGACY_STORE: &str = "axiom-desktop.dat";

// Use the immutable application identifier so a separate acceptance build cannot
// read, migrate, write or delete the installed application's vault entries.
fn credential_service(identifier: &str) -> Result<&str, String> {
    if identifier.is_empty()
        || identifier.len() > 255
        || identifier.split('.').count() < 2
        || identifier.split('.').any(|part| part.is_empty()
            || !part.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'))
    {
        return Err("Secure-storage application identity is invalid.".to_string());
    }
    Ok(identifier)
}

fn entry(app: &tauri::AppHandle, key: &str) -> Result<keyring::Entry, String> {
    crate::credential_backend::ensure_native_backend()?;
    if key.trim().is_empty() {
        return Err("Secure-storage key cannot be empty.".to_string());
    }
    keyring::Entry::new(credential_service(&app.config().identifier)?, key).map_err(|_| "Secure storage is unavailable.".to_string())
}

fn read_keyring_value(app: &tauri::AppHandle, key: &str) -> Result<Option<Value>, String> {
    match entry(app, key)?.get_password() {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|_| "A secure-storage value is corrupted.".to_string()),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Secure storage could not be read.".to_string()),
    }
}

fn write_keyring_value(app: &tauri::AppHandle, key: &str, value: &Value) -> Result<(), String> {
    let raw = serde_json::to_string(value)
        .map_err(|_| "Secure-storage value could not be encoded.".to_string())?;
    entry(app, key)?
        .set_password(&raw)
        .map_err(|_| "Secure storage could not be updated.".to_string())
}

/// Read a value from the OS credential vault. Existing 0.1.x installs are
/// migrated once from the old JSON store, then the plaintext copy is removed.
pub(crate) fn read_value(app: &tauri::AppHandle, key: &str) -> Result<Option<Value>, String> {
    if let Some(value) = read_keyring_value(app, key)? {
        return Ok(Some(value));
    }

    let store = app
        .store(LEGACY_STORE)
        .map_err(|_| "Legacy storage could not be opened.".to_string())?;
    let Some(value) = store.get(key) else {
        return Ok(None);
    };

    write_keyring_value(app, key, &value)?;
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
pub async fn write_secure_value(app: tauri::AppHandle, key: String, value: Value) -> Result<(), String> {
    write_keyring_value(&app, &key, &value)
}

#[tauri::command]
pub async fn delete_secure_value(app: tauri::AppHandle, key: String) -> Result<(), String> {
    match entry(&app, &key)?.delete_credential() {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_credential_service_remains_compatible() {
        let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(credential_service(config["identifier"].as_str().unwrap()).unwrap(), SERVICE);
    }

    #[test]
    fn development_application_cannot_share_the_production_credential_namespace() {
        let isolated = "com.visionxixlabs.axiom.acceptance";
        assert_eq!(credential_service(isolated).unwrap(), isolated);
        assert_ne!(credential_service(isolated).unwrap(), credential_service(SERVICE).unwrap());
    }

    #[test]
    fn invalid_credential_namespace_fails_closed() {
        for identifier in ["", " ", "com.visionxixlabs.axiom/acceptance", "com.visionxixlabs.axiom\n"] {
            assert!(credential_service(identifier).is_err());
        }
    }
}

#[cfg(all(test, target_os = "macos"))]
mod local_keychain_acceptance {
    #[test]
    #[ignore = "Explicit local Mac acceptance; writes only a unique nonproduction test entry"]
    fn private_keychain_round_trip_survives_entry_recreation() {
        crate::credential_backend::ensure_native_backend().unwrap();
        let service = super::credential_service("com.visionxixlabs.axiom.acceptance.tests").unwrap();
        let key = format!("owned-roundtrip-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
        let entry = keyring::Entry::new(service, &key).unwrap();
        assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
        entry.set_password("axiom-local-nonsecret-sentinel").unwrap();
        // Recreate the entry to reject an entry-local, nonpersistent mock.
        let recreated = keyring::Entry::new(service, &key).unwrap();
        let actual = recreated.get_password();
        let cleanup = recreated.delete_credential();
        assert!(cleanup.is_ok(), "Owned test credential cleanup failed");
        assert_eq!(actual.unwrap(), "axiom-local-nonsecret-sentinel");
        assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    }
}
