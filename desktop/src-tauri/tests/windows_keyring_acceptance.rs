//! Explicit Windows acceptance only: synthetic values, separate processes, no
//! production namespace, no mock fallback. Normal Cargo tests do not run this.
#![cfg(windows)]

use std::process::Command;

const SERVICE: &str = "com.visionxixlabs.axiom.windows.acceptance.tests";
const SENTINEL: &str = "axiom-windows-nonsecret-acceptance-sentinel";

fn entry(key: &str) -> keyring::Entry {
    assert!(keyring::default::default_credential_builder().as_any()
        .is::<keyring::windows::WinCredentialBuilder>(), "Real Windows credential backend is required");
    assert!(key.starts_with("owned-roundtrip-") && key.len() < 100);
    let suffix = &key["owned-roundtrip-".len()..];
    assert!(suffix.split('-').count() == 2
        && suffix.split('-').all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit())));
    keyring::Entry::new(SERVICE, key).expect("Synthetic acceptance entry unavailable")
}

#[test]
#[ignore = "Only the reviewed Windows acceptance controller invokes synthetic vault stages"]
fn acceptance_vault_stage() {
    let key = std::env::var("AXIOM_WINDOWS_ACCEPTANCE_KEY").expect("Owned synthetic key required");
    let value = entry(&key);
    match std::env::var("AXIOM_WINDOWS_ACCEPTANCE_STAGE").as_deref() {
        Ok("preflight") => {
            assert!(matches!(value.get_password(), Err(keyring::Error::NoEntry)), "Existing synthetic target is not owned by this attempt");
        }
        Ok("write") => {
            assert!(matches!(value.get_password(), Err(keyring::Error::NoEntry)), "Synthetic target must be absent before writing");
            value.set_password(SENTINEL).expect("Synthetic vault write failed");
        }
        Ok("read") => {
            let actual = value.get_password();
            assert!(matches!(actual.as_deref(), Ok(SENTINEL)), "Separate-process synthetic vault read did not match");
        }
        Ok("delete") => {
            value.delete_credential().expect("Owned synthetic credential cleanup failed");
            assert!(matches!(value.get_password(), Err(keyring::Error::NoEntry)), "Synthetic credential remains after deletion");
        }
        Ok("cleanup") => {
            assert!(matches!(value.get_password().as_deref(), Ok(SENTINEL) | Err(keyring::Error::NoEntry)), "Refuse foreign synthetic target cleanup");
            assert!(matches!(value.delete_credential(), Ok(()) | Err(keyring::Error::NoEntry)), "Owned synthetic credential cleanup failed");
            assert!(matches!(value.get_password(), Err(keyring::Error::NoEntry)), "Synthetic credential remains after cleanup");
        }
        _ => panic!("Fixed synthetic vault stage required"),
    }
}

#[test]
#[ignore = "Actual Windows Credential Manager writes: explicit reviewed acceptance only"]
fn windows_credential_persists_across_processes() {
    let key = std::env::var("AXIOM_WINDOWS_ACCEPTANCE_KEY").expect("Controller-owned synthetic key required");
    // A refused existing target must never enter this test's cleanup branch.
    assert!(matches!(entry(&key).get_password(), Err(keyring::Error::NoEntry)), "Existing synthetic target is not owned");
    let executable = std::env::current_exe().unwrap();
    let mut stage_results = Vec::new();
    for stage in ["write", "read", "delete"] {
        let mut command = Command::new(&executable);
        command.args(["--ignored", "--exact", "acceptance_vault_stage", "--nocapture"])
            .env_clear().env("AXIOM_WINDOWS_ACCEPTANCE_KEY", &key)
            .env("AXIOM_WINDOWS_ACCEPTANCE_STAGE", stage);
        for name in ["SystemRoot", "PATH", "TEMP", "TMP"] {
            if let Some(value) = std::env::var_os(name) { command.env(name, value); }
        }
        let result = command.output();
        let passed = result.as_ref().map(|r| r.status.success()).unwrap_or(false);
        // Never print returned vault data or raw child diagnostics.
        stage_results.push((stage, passed));
        if !passed { break; }
    }
    // Always attempt cleanup of this unique nonproduction target, including a
    // child-stage failure. Missing is acceptable only for this final cleanup.
    let cleanup = match entry(&key).delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => true,
        Err(_) => false,
    };
    let absent = matches!(entry(&key).get_password(), Err(keyring::Error::NoEntry));
    assert!(cleanup && absent, "Owned synthetic credential cleanup unconfirmed");
    assert_eq!(stage_results.len(), 3, "A separate-process vault stage failed");
    assert!(stage_results.iter().all(|(_, passed)| *passed), "Separate-process vault acceptance failed");
}
