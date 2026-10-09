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
    let started = std::time::Instant::now();
    let mut command = Command::new(check.executable);
    command.args(&check.args).current_dir(&root).kill_on_drop(true)
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
        if output.len() as u64 > MAX_OUTPUT_BYTES { let _ = signal.send(()).await; output.truncate(MAX_OUTPUT_BYTES as usize); }
        (read, output)
    });
    let stdout_task = read_stream(stdout, overflow_tx.clone());
    let stderr_task = tokio::spawn(async move {
        let stream = stderr;
        let mut output = Vec::new();
        let read = stream.take(MAX_OUTPUT_BYTES + 1).read_to_end(&mut output).await;
        if output.len() as u64 > MAX_OUTPUT_BYTES { let _ = overflow_tx.send(()).await; output.truncate(MAX_OUTPUT_BYTES as usize); }
        (read, output)
    });
    let status = tokio::select! {
        result = child.wait() => result.map_err(|error| format!("Verification process failed: {error}"))?,
        _ = overflow_rx.recv() => { let _ = child.kill().await; return Err("Verification stopped because output exceeded 1 MB.".to_string()); },
        _ = tokio::time::sleep(TIMEOUT) => { let _ = child.kill().await; return Err("Verification stopped after the 5 minute safety limit.".to_string()); },
    };
    let (_, stdout_bytes) = stdout_task.await.map_err(|_| "Could not collect verification output.".to_string())?;
    let (_, stderr_bytes) = stderr_task.await.map_err(|_| "Could not collect verification errors.".to_string())?;
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
