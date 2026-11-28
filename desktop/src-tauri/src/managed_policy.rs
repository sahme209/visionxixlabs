//! Organization-managed policy file, deployed by IT (Intune, Jamf, SCCM or configuration management).
//! Read-only: the app never writes it. Fixed per-platform locations that need administrator rights to
//! change. The contents are parsed and validated in the frontend; here we only read a small regular file.
use serde::Serialize;
use std::path::PathBuf;

const MAX_BYTES: u64 = 64 * 1024;

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum ManagedPolicyFile {
    /// No policy file: the app behaves as a personal install.
    None,
    Found { path: String, contents: String },
    /// A file exists but could not be read safely; the app treats this as locked.
    Invalid { path: String, reason: String },
}

pub fn policy_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var_os("ProgramData").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\ProgramData"));
        base.join("VisionXIXLabs").join("V19").join("policy.json")
    }
    #[cfg(target_os = "macos")]
    {
        PathBuf::from("/Library/Application Support/VisionXIXLabs/V19/policy.json")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        PathBuf::from("/etc/v19/policy.json")
    }
}

pub fn read_policy_file(path: &std::path::Path) -> ManagedPolicyFile {
    let shown = path.display().to_string();
    let meta = match std::fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return ManagedPolicyFile::None,
        Err(_) => return ManagedPolicyFile::Invalid { path: shown, reason: "unreadable".into() },
    };
    if !meta.file_type().is_file() {
        return ManagedPolicyFile::Invalid { path: shown, reason: "not_a_regular_file".into() };
    }
    if meta.len() > MAX_BYTES {
        return ManagedPolicyFile::Invalid { path: shown, reason: "too_large".into() };
    }
    match std::fs::read_to_string(path) {
        Ok(contents) => ManagedPolicyFile::Found { path: shown, contents },
        Err(_) => ManagedPolicyFile::Invalid { path: shown, reason: "unreadable".into() },
    }
}

#[tauri::command]
pub fn get_managed_policy() -> ManagedPolicyFile {
    read_policy_file(&policy_path())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_is_none() {
        let dir = std::env::temp_dir().join(format!("v19-policy-test-{}", std::process::id()));
        assert_eq!(read_policy_file(&dir.join("absent.json")), ManagedPolicyFile::None);
    }

    #[test]
    fn reads_small_files_and_refuses_large_ones_and_directories() {
        let dir = std::env::temp_dir().join(format!("v19-policy-test-r-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let ok = dir.join("policy.json");
        std::fs::write(&ok, "{\"updateNotices\":false}").unwrap();
        assert!(matches!(read_policy_file(&ok), ManagedPolicyFile::Found { ref contents, .. } if contents.contains("updateNotices")));
        let big = dir.join("big.json");
        std::fs::write(&big, vec![b' '; (MAX_BYTES + 1) as usize]).unwrap();
        assert!(matches!(read_policy_file(&big), ManagedPolicyFile::Invalid { ref reason, .. } if reason == "too_large"));
        assert!(matches!(read_policy_file(&dir), ManagedPolicyFile::Invalid { ref reason, .. } if reason == "not_a_regular_file"));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
