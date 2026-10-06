//! Local repository cloning.
//!
//! The desktop app never mints its own GitHub credentials — the server
//! resolves a short-lived GitHub App installation token (expires in ~1h,
//! same mechanism the server already uses for every read operation) and
//! hands this process a single clone URL with that token embedded
//! (`https://x-access-token:<token>@github.com/owner/repo.git`), scoped to
//! exactly the one repository being cloned. This module's only job is to
//! run `git clone` with that URL and make sure the token never survives
//! into anything returned to the renderer or written to disk/logs.

use std::path::PathBuf;
use std::process::Command;

/// Redacts the embedded `user:token@` credential from a git remote URL
/// before it can appear in an error message. `git`'s own stderr often
/// echoes the full remote URL verbatim on failure (e.g. "repository not
/// found"), so this must run on every error path, not just the happy path.
fn redact_credential(text: &str, clone_url: &str) -> String {
    let mut redacted = text.to_string();
    if let Some(at_pos) = clone_url.find('@') {
        if let Some(scheme_end) = clone_url.find("://") {
            let credential_part = &clone_url[scheme_end + 3..at_pos];
            if !credential_part.is_empty() {
                redacted = redacted.replace(credential_part, "***");
            }
        }
    }
    redacted
}

#[tauri::command]
pub async fn clone_repository(clone_url: String, destination_path: String) -> Result<String, String> {
    if !clone_url.starts_with("https://") {
        return Err("Clone URL must be HTTPS.".to_string());
    }
    let destination = PathBuf::from(&destination_path);
    if destination.exists() {
        return Err(format!(
            "{} already exists. Choose an empty destination folder.",
            destination.display()
        ));
    }
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
    }

    let output = Command::new("git")
        .arg("clone")
        .arg("--")
        .arg(&clone_url)
        .arg(&destination_path)
        .output()
        .map_err(|e| format!("Could not run git: {e}. Is git installed and on PATH?"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(redact_credential(&stderr, &clone_url));
    }

    Ok(destination_path)
}

/// Default parent directory for cloned repositories — `~/AxiomAgent/repos`.
/// The UI pre-fills this but lets the user pick a different destination.
#[tauri::command]
pub async fn default_repos_directory() -> Result<String, String> {
    let home = dirs_home()?;
    Ok(home.join("AxiomAgent").join("repos").to_string_lossy().to_string())
}

fn dirs_home() -> Result<PathBuf, String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the home directory.".to_string())
}

#[cfg(test)]
mod tests {
    use super::redact_credential;

    #[test]
    fn strips_the_embedded_token_from_error_text() {
        let url = "https://x-access-token:ghs_SECRET123@github.com/acme/widgets.git";
        let stderr = "fatal: repository 'https://x-access-token:ghs_SECRET123@github.com/acme/widgets.git/' not found";
        let redacted = redact_credential(stderr, url);
        assert!(!redacted.contains("ghs_SECRET123"));
        assert!(redacted.contains("***"));
    }

    #[test]
    fn leaves_error_text_unchanged_when_url_has_no_credential() {
        let url = "https://github.com/acme/widgets.git";
        let stderr = "fatal: repository 'https://github.com/acme/widgets.git/' not found";
        assert_eq!(redact_credential(stderr, url), stderr);
    }
}
