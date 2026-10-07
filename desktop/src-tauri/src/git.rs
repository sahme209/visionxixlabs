//! Tenant-scoped local repository workspace.
//!
//! Remote operations receive a short-lived, single-repository GitHub App URL
//! from the service. The credential is used for one process invocation and is
//! never stored as the repository's origin. All filesystem operations resolve
//! and validate paths beneath a canonical Git working tree.

use serde::Serialize;
use std::ffi::OsStr;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Output};

const MAX_TEXT_FILE_BYTES: u64 = 1_000_000;
const MAX_LISTED_FILES: usize = 5_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryFileStatus {
    path: String,
    status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStatus {
    root_path: String,
    repository_full_name: Option<String>,
    branch: String,
    ahead: u32,
    behind: u32,
    changed_files: Vec<RepositoryFileStatus>,
}

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

fn safe_remote_url(authenticated_url: &str) -> Result<String, String> {
    let remainder = authenticated_url
        .strip_prefix("https://")
        .ok_or_else(|| "Repository URL must use HTTPS.".to_string())?;
    let host_and_path = remainder.rsplit_once('@').map(|(_, value)| value).unwrap_or(remainder);
    if !host_and_path.starts_with("github.com/") || host_and_path.contains('\n') || host_and_path.contains('\r') {
        return Err("Only repository-scoped GitHub URLs are accepted.".to_string());
    }
    Ok(format!("https://{host_and_path}"))
}

fn git<I, S>(root: Option<&Path>, args: I) -> Result<Output, String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut command = Command::new("git");
    if let Some(root) = root {
        command.arg("-C").arg(root);
    }
    command.args(args).output().map_err(|error| format!("Could not run git: {error}. Is git installed and on PATH?"))
}

fn output_text(output: Output, credential: Option<&str>) -> Result<String, String> {
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(match credential {
        Some(url) => redact_credential(&stderr, url),
        None => stderr.trim().to_string(),
    })
}

fn repository_root(path: &str) -> Result<PathBuf, String> {
    let requested = fs::canonicalize(path).map_err(|_| "Repository folder does not exist.".to_string())?;
    let output = git(Some(&requested), ["rev-parse", "--show-toplevel"])?;
    let root = output_text(output, None)?;
    fs::canonicalize(root).map_err(|_| "Git returned an invalid repository root.".to_string())
}

fn valid_relative_path(value: &str) -> Result<PathBuf, String> {
    if value.is_empty() || value.len() > 2_048 || value.contains('\0') {
        return Err("Choose a valid repository file.".to_string());
    }
    let path = PathBuf::from(value);
    if path.is_absolute() || path.components().any(|component| !matches!(component, Component::Normal(_))) {
        return Err("Repository file paths must stay inside the working tree.".to_string());
    }
    if path.components().next().and_then(|value| value.as_os_str().to_str()) == Some(".git") {
        return Err("Git metadata cannot be opened or edited.".to_string());
    }
    Ok(path)
}

fn current_branch(root: &Path) -> Result<String, String> {
    let branch = output_text(git(Some(root), ["symbolic-ref", "--quiet", "--short", "HEAD"] )?, None)?;
    if branch.is_empty() || branch.starts_with('-') || branch.contains('\n') || branch.contains('\r') {
        return Err("A named local branch is required for this operation.".to_string());
    }
    Ok(branch)
}

fn github_repository_name(root: &Path) -> Option<String> {
    let remote = output_text(git(Some(root), ["remote", "get-url", "origin"]).ok()?, None).ok()?;
    let path = remote.strip_prefix("https://github.com/")
        .or_else(|| remote.strip_prefix("git@github.com:"))?
        .trim_end_matches(".git");
    let mut parts = path.split('/');
    let owner = parts.next()?;
    let repository = parts.next()?;
    if owner.is_empty() || repository.is_empty() || parts.next().is_some() { return None; }
    Some(format!("{owner}/{repository}"))
}

fn working_tree_is_clean(root: &Path) -> Result<bool, String> {
    Ok(output_text(git(Some(root), ["status", "--porcelain", "--untracked-files=all"] )?, None)?.is_empty())
}

#[tauri::command]
pub async fn clone_repository(clone_url: String, destination_path: String) -> Result<String, String> {
    let safe_origin = safe_remote_url(&clone_url)?;
    let destination = PathBuf::from(&destination_path);
    if destination.exists() {
        return Err(format!("{} already exists. Choose an empty destination folder.", destination.display()));
    }
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
    }
    let clone_result = output_text(
        git(None, ["clone", "--", clone_url.as_str(), destination_path.as_str()])?,
        Some(&clone_url),
    );
    if let Err(error) = clone_result {
        // A failed clone can still leave `.git/config` behind. Remove only
        // the exact destination that this command just verified was absent.
        if destination.exists() {
            let _ = fs::remove_dir_all(&destination);
        }
        return Err(error);
    }
    // git clone records its source as origin. Replace the credential-bearing
    // URL before returning success, including on a best-effort cleanup path.
    let sanitized = output_text(git(Some(&destination), ["remote", "set-url", "origin", &safe_origin])?, Some(&clone_url));
    if let Err(error) = sanitized {
        let _ = fs::remove_dir_all(&destination);
        return Err(format!("Clone was removed because its credential could not be scrubbed: {error}"));
    }
    Ok(destination_path)
}

#[tauri::command]
pub async fn default_repos_directory() -> Result<String, String> {
    Ok(dirs_home()?.join("AxiomAgent").join("repos").to_string_lossy().to_string())
}

#[tauri::command]
pub async fn list_local_repositories(parent_path: String) -> Result<Vec<String>, String> {
    let parent = PathBuf::from(&parent_path);
    if !parent.exists() {
        return Ok(Vec::new());
    }
    let mut repositories = Vec::new();
    for entry in fs::read_dir(&parent).map_err(|error| format!("Could not read repository folder: {error}"))? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_dir() && path.join(".git").is_dir() {
            repositories.push(path.to_string_lossy().to_string());
        }
    }
    repositories.sort();
    Ok(repositories)
}

#[tauri::command]
pub async fn repository_status(repository_path: String) -> Result<RepositoryStatus, String> {
    let root = repository_root(&repository_path)?;
    let branch = current_branch(&root)?;
    let porcelain = output_text(git(Some(&root), ["status", "--porcelain", "--untracked-files=all"] )?, None)?;
    let changed_files = porcelain.lines().filter_map(|line| {
        if line.len() < 4 { return None; }
        Some(RepositoryFileStatus { status: line[..2].trim().to_string(), path: line[3..].to_string() })
    }).collect();
    let counts = output_text(git(Some(&root), ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"] )?, None)
        .unwrap_or_else(|_| "0\t0".to_string());
    let mut parts = counts.split_whitespace().filter_map(|value| value.parse::<u32>().ok());
    Ok(RepositoryStatus {
        root_path: root.to_string_lossy().to_string(), repository_full_name: github_repository_name(&root), branch,
        ahead: parts.next().unwrap_or(0), behind: parts.next().unwrap_or(0), changed_files,
    })
}

#[tauri::command]
pub async fn list_repository_files(repository_path: String) -> Result<Vec<String>, String> {
    let root = repository_root(&repository_path)?;
    let output = git(Some(&root), ["ls-files", "-co", "--exclude-standard", "-z"])?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
    let mut files: Vec<String> = output.stdout.split(|byte| *byte == 0)
        .filter(|value| !value.is_empty())
        .filter_map(|value| String::from_utf8(value.to_vec()).ok())
        .filter(|value| !value.starts_with(".git/"))
        .take(MAX_LISTED_FILES)
        .collect();
    files.sort();
    Ok(files)
}

#[tauri::command]
pub async fn read_repository_file(repository_path: String, relative_path: String) -> Result<String, String> {
    let root = repository_root(&repository_path)?;
    let relative = valid_relative_path(&relative_path)?;
    let candidate = fs::canonicalize(root.join(relative)).map_err(|_| "Repository file was not found.".to_string())?;
    if !candidate.starts_with(&root) || !candidate.is_file() {
        return Err("Repository file must stay inside the working tree.".to_string());
    }
    let metadata = fs::metadata(&candidate).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_TEXT_FILE_BYTES { return Err("Files larger than 1 MB are not opened in the editor.".to_string()); }
    fs::read_to_string(candidate).map_err(|_| "Only UTF-8 text files can be edited.".to_string())
}

#[tauri::command]
pub async fn write_repository_file(repository_path: String, relative_path: String, content: String) -> Result<(), String> {
    if content.len() as u64 > MAX_TEXT_FILE_BYTES { return Err("Files larger than 1 MB cannot be saved.".to_string()); }
    let root = repository_root(&repository_path)?;
    let relative = valid_relative_path(&relative_path)?;
    let candidate = root.join(&relative);
    let parent = candidate.parent().ok_or_else(|| "Repository file needs a parent folder.".to_string())?;
    let canonical_parent = fs::canonicalize(parent).map_err(|_| "The file's parent folder must already exist.".to_string())?;
    if !canonical_parent.starts_with(&root) { return Err("Repository file must stay inside the working tree.".to_string()); }
    if candidate.exists() {
        if fs::symlink_metadata(&candidate).map_err(|error| error.to_string())?.file_type().is_symlink() {
            return Err("Symbolic links cannot be edited.".to_string());
        }
        let canonical_file = fs::canonicalize(&candidate).map_err(|error| error.to_string())?;
        if !canonical_file.starts_with(&root) { return Err("Repository file must stay inside the working tree.".to_string()); }
    }
    fs::write(candidate, content).map_err(|error| format!("Could not save file: {error}"))
}

#[tauri::command]
pub async fn commit_repository_file(repository_path: String, relative_path: String, message: String) -> Result<String, String> {
    if message.trim().is_empty() || message.len() > 500 { return Err("Enter a commit message up to 500 characters.".to_string()); }
    let root = repository_root(&repository_path)?;
    let relative = valid_relative_path(&relative_path)?;
    output_text(git(Some(&root), [OsStr::new("add"), OsStr::new("--"), relative.as_os_str()])?, None)?;
    output_text(git(Some(&root), ["commit", "-m", message.trim(), "--", relative.to_string_lossy().as_ref()])?, None)?;
    output_text(git(Some(&root), ["rev-parse", "HEAD"] )?, None)
}

#[tauri::command]
pub async fn create_repository_branch(repository_path: String, branch_name: String) -> Result<String, String> {
    let root = repository_root(&repository_path)?;
    let candidate = branch_name.trim();
    if candidate.is_empty() || candidate.len() > 240 || candidate.starts_with('-') {
        return Err("Enter a valid branch name.".to_string());
    }
    output_text(git(Some(&root), ["check-ref-format", "--branch", candidate])?, None)?;
    output_text(git(Some(&root), ["switch", "-c", candidate])?, None)?;
    Ok(candidate.to_string())
}

#[tauri::command]
pub async fn pull_repository(repository_path: String, authenticated_url: String) -> Result<String, String> {
    safe_remote_url(&authenticated_url)?;
    let root = repository_root(&repository_path)?;
    if !working_tree_is_clean(&root)? { return Err("Commit or discard local changes before pulling.".to_string()); }
    let branch = current_branch(&root)?;
    let refspec = format!("+refs/heads/{branch}:refs/remotes/origin/{branch}");
    output_text(git(Some(&root), ["fetch", "--prune", &authenticated_url, &refspec])?, Some(&authenticated_url))?;
    output_text(git(Some(&root), ["merge", "--ff-only", &format!("refs/remotes/origin/{branch}")])?, None)
}

#[tauri::command]
pub async fn push_repository(repository_path: String, authenticated_url: String) -> Result<String, String> {
    safe_remote_url(&authenticated_url)?;
    let root = repository_root(&repository_path)?;
    let branch = current_branch(&root)?;
    output_text(git(Some(&root), ["push", &authenticated_url, &format!("HEAD:refs/heads/{branch}")])?, Some(&authenticated_url))
}

fn dirs_home() -> Result<PathBuf, String> {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from)
        .ok_or_else(|| "Could not determine the home directory.".to_string())
}

#[cfg(test)]
mod tests {
    use super::{redact_credential, safe_remote_url, valid_relative_path};

    #[test]
    fn strips_the_embedded_token_from_error_text() {
        let url = "https://x-access-token:ghs_SECRET123@github.com/acme/widgets.git";
        let stderr = "fatal: repository 'https://x-access-token:ghs_SECRET123@github.com/acme/widgets.git/' not found";
        let redacted = redact_credential(stderr, url);
        assert!(!redacted.contains("ghs_SECRET123"));
        assert!(redacted.contains("***"));
    }

    #[test]
    fn derives_a_credential_free_origin() {
        assert_eq!(safe_remote_url("https://x-access-token:secret@github.com/acme/widgets.git").unwrap(), "https://github.com/acme/widgets.git");
        assert!(safe_remote_url("https://evil.example/acme/widgets.git").is_err());
    }

    #[test]
    fn rejects_repository_path_traversal_and_git_metadata() {
        assert!(valid_relative_path("src/app.ts").is_ok());
        assert!(valid_relative_path("../secret").is_err());
        assert!(valid_relative_path(".git/config").is_err());
    }
}
