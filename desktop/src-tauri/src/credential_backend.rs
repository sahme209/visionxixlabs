/// Refuse keyring's entry-local mock backend before reading a legacy value or
/// attempting a write. A successful mock write is not durable credential storage.
pub(crate) fn ensure_native_backend() -> Result<(), String> {
    require_persistent_builder(keyring::default::default_credential_builder().as_ref())
}

fn require_persistent_builder(builder: &keyring::CredentialBuilder) -> Result<(), String> {
    if builder.as_any().is::<keyring::mock::MockCredentialBuilder>() {
        return Err("Native credential storage is not configured for this platform.".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_mock_without_accessing_any_vault() {
        assert!(require_persistent_builder(keyring::mock::default_credential_builder().as_ref()).is_err());
    }

    #[test]
    fn configured_default_is_native_without_accessing_any_vault() {
        assert!(ensure_native_backend().is_ok());
        let builder = keyring::default::default_credential_builder();
        #[cfg(target_os = "macos")]
        assert!(builder.as_any().is::<keyring::macos::MacCredentialBuilder>());
        #[cfg(target_os = "windows")]
        assert!(builder.as_any().is::<keyring::windows::WinCredentialBuilder>());
        #[cfg(target_os = "linux")]
        assert!(builder.as_any().is::<keyring::secret_service::SsCredentialBuilder>());
    }
}
