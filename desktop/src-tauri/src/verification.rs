//! Explicit, bounded local verification for repository changes.
//!
//! The UI never supplies a shell command. It selects one server-detected
//! check id, which is resolved again here before execution. Repository scripts
//! are untrusted code, so the desktop requires confirmation and runs them with
//! a minimal environment, timeout, and output cap.

use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::mpsc;

const MAX_OUTPUT_BYTES: u64 = 1_000_000;
const TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryCheck {
    id: String,
    label: String,
    command: String,
    description: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryCheckResult {
    check_id: String,
    success: bool,
    exit_code: Option<i32>,
    output: String,
    duration_ms: u128,
}

#[derive(Clone)]
struct CheckCommand {
    definition: RepositoryCheck,
    executable: &'static str,
    args: Vec<String>,
}

fn add_check(checks: &mut Vec<CheckCommand>, id: &str, label: &str, command: &str, description: &str, executable: &'static str, args: &[&str]) {
    checks.push(CheckCommand {
        definition: RepositoryCheck { id: id.into(), label: label.into(), command: command.into(), description: description.into() },
        executable,
        args: args.iter().map(|value| (*value).to_string()).collect(),
    });
}

fn detected_checks(root: &Path) -> Result<Vec<CheckCommand>, String> {
    let mut checks = Vec::new();
    let package_json = root.join("package.json");
    if package_json.is_file() {
        let document: serde_json::Value = serde_json::from_slice(&std::fs::read(package_json).map_err(|error| error.to_string())?)
            .map_err(|_| "package.json is not valid JSON.".to_string())?;
        let scripts = document.get("scripts").and_then(|value| value.as_object()).cloned().unwrap_or_default();
        let known: BTreeMap<&str, (&str, &str)> = BTreeMap::from([
            ("typecheck", ("Type check", "Check static types without changing files.")),
            ("lint", ("Lint", "Check the repository's configured code-quality rules.")),
            ("test", ("Tests", "Run the repository's configured automated tests in CI mode.")),
        ]);
        for (script, (label, description)) in known {
            if scripts.get(script).and_then(|value| value.as_str()).is_some() {
                add_check(&mut checks, &format!("npm:{script}"), label, &format!("npm run {script}"), description, "npm", &["run", script]);
            }
        }
    }
    if root.join("Cargo.toml").is_file() {
        add_check(&mut checks, "cargo:check", "Rust check", "cargo check", "Compile and type-check Rust without producing a release.", "cargo", &["check"]);
        add_check(&mut checks, "cargo:test", "Rust tests", "cargo test", "Run the repository's Rust tests.", "cargo", &["test"]);
    }
    if root.join("Package.swift").is_file() {
        add_check(&mut checks, "swift:test", "Swift tests", "swift test", "Build the Swift package and run its tests.", "swift", &["test"]);
    }
    Ok(checks)
}

#[tauri::command]
pub async fn detect_repository_checks(repository_path: String) -> Result<Vec<RepositoryCheck>, String> {
    let root = crate::git::repository_root(&repository_path)?;
    Ok(detected_checks(&root)?.into_iter().map(|check| check.definition).collect())
}

#[tauri::command]
pub async fn run_repository_check(repository_path: String, check_id: String) -> Result<RepositoryCheckResult, String> {
    let root = crate::git::repository_root(&repository_path)?;
    let check = detected_checks(&root)?.into_iter().find(|check| check.definition.id == check_id)
        .ok_or_else(|| "That verification check is not available for this repository.".to_string())?;
    run_detected_check(&root, check, TIMEOUT).await
}

async fn run_detected_check(root: &Path, check: CheckCommand, deadline: Duration) -> Result<RepositoryCheckResult, String> {
    let check_id = check.definition.id.clone();
    let started = std::time::Instant::now();
    let mut command = Command::new(check.executable);
    command.args(&check.args).current_dir(root).kill_on_drop(true)
        .env_clear().env("PATH", std::env::var_os("PATH").unwrap_or_default())
        .env("HOME", std::env::var_os("HOME").unwrap_or_default())
        .env("CI", "1").env("NO_COLOR", "1")
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| format!("Could not start {}: {error}", check.definition.command))?;
    let stdout = child.stdout.take().ok_or_else(|| "Could not capture verification output.".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Could not capture verification errors.".to_string())?;
    let (overflow_tx, mut overflow_rx) = mpsc::channel::<()>(2);
    let read_stream = |stream: tokio::process::ChildStdout, signal: mpsc::Sender<()>| tokio::spawn(async move {
        let mut output = Vec::new();
        let read = stream.take(MAX_OUTPUT_BYTES + 1).read_to_end(&mut output).await;
        if output.len() as u64 > MAX_OUTPUT_BYTES { let _ = signal.send(()).await; }
        (read, output)
    });
    // Aborting collectors on every exit also releases inherited pipes when a
    // descendant outlives the direct child. This does not terminate that descendant.
    struct Readers {
        stdout: tokio::task::JoinHandle<(std::io::Result<usize>, Vec<u8>)>,
        stderr: tokio::task::JoinHandle<(std::io::Result<usize>, Vec<u8>)>,
    }
    impl Drop for Readers {
        fn drop(&mut self) { self.stdout.abort(); self.stderr.abort(); }
    }
    let mut readers = Readers {
        stdout: read_stream(stdout, overflow_tx.clone()),
        stderr: tokio::spawn(async move {
            let mut output = Vec::new();
            let read = stderr.take(MAX_OUTPUT_BYTES + 1).read_to_end(&mut output).await;
            if output.len() as u64 > MAX_OUTPUT_BYTES { let _ = overflow_tx.send(()).await; }
            (read, output)
        }),
    };
    // The deadline covers BOTH process exit and pipe drain. Waiting for the
    // direct child alone does not bound output collection from inherited pipes.
    let completion = async {
        let status = child.wait().await.map_err(|error| format!("Verification process failed: {error}"))?;
        let (stdout_read, stdout_bytes) = (&mut readers.stdout).await.map_err(|_| "Could not collect verification output.".to_string())?;
        let (stderr_read, stderr_bytes) = (&mut readers.stderr).await.map_err(|_| "Could not collect verification errors.".to_string())?;
        stdout_read.map_err(|_| "Could not read verification output.".to_string())?;
        stderr_read.map_err(|_| "Could not read verification errors.".to_string())?;
        if stdout_bytes.len() + stderr_bytes.len() > MAX_OUTPUT_BYTES as usize {
            return Err("Verification stopped because combined output exceeded 1 MB.".to_string());
        }
        Ok((status, stdout_bytes, stderr_bytes))
    };
    let completed = tokio::select! {
        result = completion => result,
        Some(()) = overflow_rx.recv() => Err("Verification stopped because output exceeded 1 MB.".to_string()),
        _ = tokio::time::sleep(deadline) => Err("Verification stopped after the 5 minute process/output safety limit.".to_string()),
    };
    // Bound cleanup as well; kill_on_drop remains a direct-child fallback.
    if completed.is_err() { let _ = tokio::time::timeout(Duration::from_secs(2), child.kill()).await; }
    let (status, stdout_bytes, stderr_bytes) = completed?;
    let mut output = String::from_utf8_lossy(&stdout_bytes).to_string();
    if !stderr_bytes.is_empty() {
        if !output.is_empty() { output.push('\n'); }
        output.push_str(&String::from_utf8_lossy(&stderr_bytes));
    }
    Ok(RepositoryCheckResult {
        check_id,
        success: status.success(),
        exit_code: status.code(),
        output: output.trim().to_string(),
        duration_ms: started.elapsed().as_millis(),
    })
}


#[cfg(all(test, unix))]
mod tests {
    use super::*;
    fn shell(script: &str) -> CheckCommand {
        CheckCommand {
            definition: RepositoryCheck { id: "fixture".into(), label: "Fixture".into(), command: "fixture shell".into(), description: "Isolated native test".into() },
            executable: "/bin/sh", args: vec!["-c".into(), script.into()],
        }
    }
    #[tokio::test]
    async fn captures_both_streams_and_nonzero_exit() {
        let result = run_detected_check(&std::env::temp_dir(), shell("printf stdout; printf stderr >&2; exit 7"), Duration::from_secs(2)).await.unwrap();
        assert!(!result.success);
        assert_eq!(result.exit_code, Some(7));
        assert_eq!(result.output, "stdout\nstderr");
    }
    #[tokio::test]
    async fn rejects_combined_output_even_when_each_stream_is_under_limit() {
        let result = run_detected_check(&std::env::temp_dir(), shell("printf '%600000s' ''; printf '%600000s' '' >&2"), Duration::from_secs(2)).await;
        assert!(result.unwrap_err().contains("combined output"));
    }
    #[tokio::test]
    async fn deadline_includes_pipes_retained_after_direct_child_exit() {
        // The short-lived descendant is intentionally not claimed as canceled.
        let result = run_detected_check(&std::env::temp_dir(), shell("sleep 0.3 & exit 0"), Duration::from_millis(40)).await;
        assert!(result.unwrap_err().contains("safety limit"));
    }
    #[tokio::test]
    async fn deadline_bounds_direct_child_and_collectors() {
        let result = run_detected_check(&std::env::temp_dir(), shell("sleep 0.3"), Duration::from_millis(40)).await;
        assert!(result.unwrap_err().contains("safety limit"));
    }
}
