//! Exclusive new source-file creation; never an existing-file Save.
//! Name reservation is atomic. Content writes are not atomic publication; failures
//! retain the new file for review rather than risk deleting a replaced path.
use std::path::Path;
#[cfg(unix)]
use std::path::Component;

#[cfg(unix)]
fn checked_parts(path: &str, content: &str) -> Result<Vec<String>, String> {
    if path.is_empty() || path.len() > 1024 || path.contains(['\\', '\0', '\r', '\n', ':']) || path.split('/').any(|part| part.is_empty() || part == "." || part == "..") || content.len() > 100_000 {
        return Err("Invalid or oversized creation draft.".into());
    }
    let parts: Vec<_> = Path::new(path).components().map(|part| match part {
        Component::Normal(value) => value.to_str().map(str::to_string), _ => None,
    }).collect::<Option<Vec<_>>>().ok_or("Creation path must stay inside the repository.")?;
    let leaf = parts.last().ok_or("Creation path is empty.")?.to_lowercase();
    let sensitive = parts.iter().any(|part| matches!(part.to_lowercase().as_str(), ".git" | ".aws" | ".ssh" | ".kube" | "secrets" | "credentials"))
        || leaf.starts_with(".env") || matches!(leaf.as_str(), ".npmrc" | ".pypirc" | ".netrc")
        || leaf.split(['.', '_', '-']).any(|part| matches!(part, "secret" | "secrets" | "credential" | "credentials"))
        || parts.iter().map(|part| part.to_lowercase()).any(|part| part == "id_rsa" || part.starts_with("id_rsa.") || part == "id_ed25519" || part.starts_with("id_ed25519."))
        || [".pem", ".key", ".p12", ".pfx", ".jks", ".keystore"].iter().any(|suffix| leaf.ends_with(suffix));
    if sensitive { return Err("Sensitive paths cannot be created by an Agent proposal.".into()); }
    Ok(parts)
}

#[cfg(unix)]
pub(crate) fn create(root: &Path, path: &str, content: &str) -> Result<(), String> {
    use std::ffi::CString;
    use std::fs::{File, OpenOptions};
    use std::io::Write;
    use std::os::fd::{AsRawFd, FromRawFd};
    use std::os::unix::fs::OpenOptionsExt;
    let parts = checked_parts(path, content)?;
    let mut parent = OpenOptions::new().read(true).custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(root).map_err(|_| "Cannot open the repository directory.")?;
    for part in &parts[..parts.len() - 1] {
        let name = CString::new(part.as_str()).map_err(|_| "Invalid parent name.")?;
        // SAFETY: name is NUL-terminated, parent owns a live directory descriptor.
        let fd = unsafe { libc::openat(parent.as_raw_fd(), name.as_ptr(), libc::O_RDONLY | libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC) };
        if fd < 0 { return Err("Creation requires existing non-symlink parent directories.".into()); }
        // SAFETY: successful openat returns a new descriptor uniquely owned here.
        parent = unsafe { File::from_raw_fd(fd) };
    }
    let leaf = CString::new(parts.last().expect("checked path").as_str()).map_err(|_| "Invalid file name.")?;
    // SAFETY: valid leaf and live directory descriptor; O_EXCL atomically refuses
    // ANY existing leaf (including empty files and symlinks). No path reopening.
    // C varargs needs integer promotion: macOS mode_t is u16 (Rust E0617).
    let fd = unsafe { libc::openat(parent.as_raw_fd(), leaf.as_ptr(), libc::O_WRONLY | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC, 0o600 as libc::c_uint) };
    if fd < 0 { return Err("Target already exists or cannot be created; nothing was overwritten.".into()); }
    // SAFETY: successful openat returns a uniquely owned new descriptor.
    let mut file = unsafe { File::from_raw_fd(fd) };
    file.write_all(content.as_bytes()).and_then(|_| file.sync_all())
        .map_err(|_| "New file may be partial: writing or syncing failed. Inspect it before retrying; no existing file was overwritten.".into())

}

#[cfg(not(unix))]
pub(crate) fn create(_root: &Path, _path: &str, _content: &str) -> Result<(), String> {
    Err("Safe local file creation is unavailable on this platform.".into())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    #[test]
    fn rejects_unsafe_and_sensitive_drafts() {
        for path in ["../escape", "/escape", ".git/config", "src/.env", "secrets/value", "credentials.json", "x.pem", "a\\b", "ID_RSA", "keys/ID_ED25519.pub", "a/./b", ""] {
            assert!(checked_parts(path, "content").is_err(), "{path}");
        }
        assert!(checked_parts("tests/new_test.rs", "content").is_ok());
    }
    #[test]
    fn concurrent_creations_never_replace_the_winner() {
        let root = std::env::temp_dir().join(format!("axiom-create-race-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir(&root).unwrap();
        let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
        let handles: Vec<_> = (0..2).map(|i| {
            let directory = root.clone(); let ready = barrier.clone();
            std::thread::spawn(move || { ready.wait(); create(&directory, "race.rs", if i == 0 {"first"} else {"second"}).is_ok() })
        }).collect();
        assert_eq!(handles.into_iter().map(|handle| handle.join().unwrap()).filter(|won| *won).count(), 1);
        let text = std::fs::read_to_string(root.join("race.rs")).unwrap();
        assert!(text == "first" || text == "second");
        assert!(create(&root, "missing/file.rs", "content").is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn creates_complete_bytes_without_overwriting_empty_or_nonempty_files() {
        let root = std::env::temp_dir().join(format!("axiom-create-test-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir(&root).unwrap();
        create(&root, "new.rs", "new code").unwrap();
        assert!(create(&root, "new.rs", "overwrite").is_err());
        assert_eq!(std::fs::read_to_string(root.join("new.rs")).unwrap(), "new code");
        std::fs::write(root.join("empty.rs"), "").unwrap();
        assert!(create(&root, "empty.rs", "overwrite").is_err());
        assert_eq!(std::fs::read_to_string(root.join("empty.rs")).unwrap(), "");
        std::os::unix::fs::symlink(std::env::temp_dir(), root.join("linked")).unwrap();
        assert!(create(&root, "linked/escape.rs", "forbidden").is_err());
        std::os::unix::fs::symlink(root.join("new.rs"), root.join("leaf.rs")).unwrap();
        assert!(create(&root, "leaf.rs", "forbidden").is_err());
        assert_eq!(std::fs::read_dir(&root).unwrap().filter(|entry| entry.as_ref().unwrap().file_name().to_string_lossy().starts_with(".axiom-create-")).count(), 0);
        std::fs::remove_dir_all(root).unwrap();
    }
}
