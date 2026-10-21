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
use tokio::sync::{mpsc, watch};
use std::sync::{Mutex, OnceLock};
use std::sync::atomic::{AtomicU64, Ordering};

struct OwnedRun { prepared_at: std::time::Instant, root: std::path::PathBuf, check_id: String, configuration: Vec<u8>, window: String, sender: watch::Sender<bool>, receiver: Option<watch::Receiver<bool>> }
static RUNS: OnceLock<Mutex<BTreeMap<String, OwnedRun>>> = OnceLock::new();
static NEXT_RUN: AtomicU64 = AtomicU64::new(1);
fn runs() -> &'static Mutex<BTreeMap<String, OwnedRun>> { RUNS.get_or_init(|| Mutex::new(BTreeMap::new())) }

#[tauri::command]
pub async fn prepare_repository_check(window: tauri::WebviewWindow, repository_path: String, check_id: String) -> Result<String, String> {
    let root = crate::git::repository_root(&repository_path)?;
    if !detected_checks(&root)?.iter().any(|check| check.definition.id == check_id) { return Err("Check unavailable.".into()); }
    let configuration = check_configuration(&root, &check_id)?;
    let mut registry = runs().lock().map_err(|_| "Verification registry unavailable.")?;
    registry.retain(|_, run| run.receiver.is_none() || run.prepared_at.elapsed() < Duration::from_secs(60));
    if registry.len() >= 32 { return Err("Too many pending verification runs.".into()); }
    let id = NEXT_RUN.fetch_add(1, Ordering::Relaxed).to_string();
    let (sender, receiver) = watch::channel(false);
    registry.insert(id.clone(), OwnedRun { prepared_at: std::time::Instant::now(), root, check_id, configuration, window: window.label().into(), sender, receiver: Some(receiver) });
    Ok(id)
}

#[tauri::command]
pub async fn cancel_repository_check(window: tauri::WebviewWindow, repository_path: String, run_id: String) -> Result<bool, String> {
    let root = crate::git::repository_root(&repository_path)?;
    let mut registry = runs().lock().map_err(|_| "Verification registry unavailable.")?;
    let Some(run) = registry.get_mut(&run_id) else { return Ok(false); };
    if run.root != root || run.window != window.label() { return Err("Verification ownership changed.".into()); }
    run.sender.send_replace(true);
    if run.receiver.is_some() { registry.remove(&run_id); }
    Ok(true)
}

struct RunGuard(String);
impl Drop for RunGuard { fn drop(&mut self) { if let Ok(mut registry) = runs().lock() { registry.remove(&self.0); } } }

const MAX_OUTPUT_BYTES: u64 = 1_000_000;
const MAX_CHECK_CONFIGURATION_BYTES: u64 = 1_000_000;

fn check_configuration(root: &Path, check_id: &str) -> Result<Vec<u8>, String> {
    let manifest = if check_id.starts_with("npm:") { "package.json" }
        else if check_id.starts_with("cargo:") { "Cargo.toml" }
        else if check_id.starts_with("swift:") { "Package.swift" }
        else { return Err("Unsupported verification definition.".into()); };
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        // A replaced FIFO must not block the registry/IPC indefinitely.
        options.custom_flags(libc::O_NONBLOCK);
    }
    let file = options.open(root.join(manifest)).map_err(|_| "Verification definition unavailable.".to_string())?;
    if !file.metadata().map_err(|_| "Verification definition metadata unavailable.".to_string())?.is_file() {
        return Err("Verification definition must be a regular file.".into());
    }
    let mut limited = std::io::Read::take(file, MAX_CHECK_CONFIGURATION_BYTES + 1);
    let mut bytes = Vec::new();
    std::io::Read::read_to_end(&mut limited, &mut bytes).map_err(|_| "Could not read verification definition.".to_string())?;
    if bytes.len() as u64 > MAX_CHECK_CONFIGURATION_BYTES {
        return Err("Verification definition exceeds its 1 MB safety limit.".into());
    }
    Ok(bytes)
}

fn verify_check_configuration(root: &Path, check_id: &str, prepared: &[u8]) -> Result<(), String> {
    if check_configuration(root, check_id)? != prepared {
        return Err("Verification definition changed. Review and prepare a new check.".into());
    }
    Ok(())
}

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
        let document: serde_json::Value = serde_json::from_slice(&check_configuration(root, "npm:test")?)
            .map_err(|_| "package.json is not valid JSON.".to_string())?;
        let scripts = document.get("scripts").and_then(|value| value.as_object()).cloned().unwrap_or_default();
        let known: BTreeMap<&str, (&str, &str)> = BTreeMap::from([
            ("build", ("Build", "Run the configured build script; it may write build artifacts. Repository scripts are not sandboxed.")),
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
pub async fn run_repository_check(window: tauri::WebviewWindow, repository_path: String, check_id: String, run_id: String) -> Result<RepositoryCheckResult, String> {
    let root = crate::git::repository_root(&repository_path)?;
    let check = detected_checks(&root)?.into_iter().find(|check| check.definition.id == check_id)
        .ok_or_else(|| "That verification check is not available for this repository.".to_string())?;
    let receiver = claim_prepared_run(&root, &check_id, &run_id, window.label())?;
    let _guard = RunGuard(run_id.clone());
    let result = run_detected_check_cancelable(&root, check, TIMEOUT, receiver).await;
    // Linearize completion against cancel under the same registry lock. A cancel
    // accepted before removal can never become a successful native receipt.
    let mut registry = runs().lock().map_err(|_| "Verification registry unavailable.")?;
    let canceled = registry.remove(&run_id).map(|run| { let canceled = *run.sender.borrow(); canceled }).unwrap_or(true);
    if canceled { return Err("Verification canceled; no passing receipt. Direct-child cleanup is bounded; descendant status remains unverified.".into()); }
    result
}

fn claim_prepared_run(root: &Path, check_id: &str, run_id: &str, window: &str) -> Result<watch::Receiver<bool>, String> {
    let mut registry = runs().lock().map_err(|_| "Verification registry unavailable.")?;
    let run = registry.get_mut(run_id).ok_or("Verification run is no longer available.")?;
    if run.root != root || run.check_id != check_id || run.window != window { return Err("Verification ownership changed.".into()); }
    if run.prepared_at.elapsed() >= Duration::from_secs(60) { return Err("Verification preparation expired.".into()); }
    verify_check_configuration(root, check_id, &run.configuration)?;
    run.receiver.take().ok_or_else(|| "Verification run already started.".into())
}

#[cfg(test)]
async fn run_detected_check(root: &Path, check: CheckCommand, deadline: Duration) -> Result<RepositoryCheckResult, String> {
    let (_sender, receiver) = watch::channel(false);
    run_detected_check_cancelable(root, check, deadline, receiver).await
}

// Only a process group created for this invocation may be signaled. A group
// guard also cleans up if this future is dropped before its normal exit path.
#[cfg(unix)]
struct OwnedProcessGroup(Option<u32>);

#[cfg(unix)]
impl Drop for OwnedProcessGroup {
    fn drop(&mut self) {
        let Some(group) = self.0.and_then(|id| i32::try_from(id).ok()) else { return; };
        // Never signal PID 0/-1 or our caller's process group, even if an
        // unexpected spawn implementation failed to provide a valid child id.
        if group <= 1 { return; }
        // SAFETY: group is the positive PID of our child, which was spawned with
        // process_group(0). Negative group targets only that owned process group.
        unsafe {
            if group != libc::getpgrp()
                && child_exited_without_reaping(group as u32).is_ok()
            {
                let _ = libc::kill(-group, libc::SIGKILL);
            }
        }
    }
}

// WNOWAIT observes status without releasing the leader's PID/PGID identity.
// Never poll Child::wait before owned-group cleanup: reaping first permits
// numeric group-id reuse while a detached descendant still holds output pipes.
#[cfg(unix)]
fn child_exited_without_reaping(id: u32) -> std::io::Result<bool> {
    // SAFETY: siginfo_t is a C output record; zero initialization also lets a
    // WNOHANG call distinguish "no exit event" from a reported SIGCHLD event.
    let mut info: libc::siginfo_t = unsafe { std::mem::zeroed() };
    let result = unsafe {
        libc::waitid(libc::P_PID, id as libc::id_t, &mut info,
            libc::WEXITED | libc::WNOWAIT | libc::WNOHANG)
    };
    if result == 0 { Ok(info.si_signo == libc::SIGCHLD) }
    else { Err(std::io::Error::last_os_error()) }
}

#[cfg(unix)]
async fn wait_for_unreaped_exit(id: u32) -> Result<(), String> {
    loop {
        match child_exited_without_reaping(id) {
            Ok(true) => return Ok(()),
            Ok(false) => tokio::time::sleep(Duration::from_millis(10)).await,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => return Err("Verification child ownership could not be confirmed.".into()),
        }
    }
}

// Finder-launched macOS apps commonly receive only system directories. Resolve
// installed package-manager tools without evaluating a login shell or profiles.
fn verification_path(inherited: Option<std::ffi::OsString>) -> Result<std::ffi::OsString, String> {
    #[cfg(target_os = "macos")]
    {
        let mut paths: Vec<std::path::PathBuf> = inherited.as_deref()
            .map(std::env::split_paths).into_iter().flatten()
            .filter(|path| path.is_absolute()).collect();
        for directory in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"] {
            let path = std::path::PathBuf::from(directory);
            if !paths.contains(&path) { paths.push(path); }
        }
        std::env::join_paths(paths).map_err(|_| "Verification executable search path is invalid.".into())
    }
    #[cfg(not(target_os = "macos"))]
    { Ok(inherited.unwrap_or_default()) }
}

async fn run_detected_check_cancelable(root: &Path, check: CheckCommand, deadline: Duration, mut cancel: watch::Receiver<bool>) -> Result<RepositoryCheckResult, String> {
    if *cancel.borrow() { return Err("Verification canceled before spawn; no passing receipt.".into()); }
    let check_id = check.definition.id.clone();
    let started = std::time::Instant::now();
    let mut command = Command::new(check.executable);
    command.args(&check.args).current_dir(root).kill_on_drop(true)
        .env_clear().env("PATH", verification_path(std::env::var_os("PATH"))?)
        .env("HOME", std::env::var_os("HOME").unwrap_or_default())
        .env("CI", "1").env("NO_COLOR", "1")
        .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    #[cfg(unix)]
    command.process_group(0);
    let mut child = command.spawn().map_err(|error| format!("Could not start {}: {error}", check.definition.command))?;
    #[cfg(unix)]
    let process_group = OwnedProcessGroup(child.id());
    let stdout = child.stdout.take().ok_or_else(|| "Could not capture verification output.".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Could not capture verification errors.".to_string())?;
    let (overflow_tx, mut overflow_rx) = mpsc::channel::<()>(2);
    let read_stream = |stream: tokio::process::ChildStdout, signal: mpsc::Sender<()>| tokio::spawn(async move {
        let mut output = Vec::new();
        let read = stream.take(MAX_OUTPUT_BYTES + 1).read_to_end(&mut output).await;
        if output.len() as u64 > MAX_OUTPUT_BYTES { let _ = signal.send(()).await; }
        (read, output)
    });
    // Aborting collectors releases inherited pipes on every exit. Unix owned
    // group cleanup handles attached descendants; detached ones remain unverified.
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
        #[cfg(unix)]
        let status: Option<std::process::ExitStatus> = {
            let id = child.id().ok_or("Verification child identity is unavailable.")?;
            wait_for_unreaped_exit(id).await?;
            None
        };
        #[cfg(not(unix))]
        let status = Some(child.wait().await.map_err(|error| format!("Verification process failed: {error}"))?);
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
        biased;
        _ = cancel.changed() => Err("Verification canceled. Direct-child stop requested; descendants are unverified and may still be running. No passing receipt.".to_string()),
        result = completion => result,
        Some(()) = overflow_rx.recv() => Err("Verification stopped because output exceeded 1 MB.".to_string()),
        _ = tokio::time::sleep(deadline) => Err("Verification stopped after the 5 minute process/output safety limit.".to_string()),
    };
    let completed = if *cancel.borrow() { Err("Verification canceled. Direct-child stop requested; descendants are unverified and may still be running. No passing receipt.".to_string()) } else { completed };
    // Stop owned group members before waiting on the direct-child fallback.
    // Deliberately detached processes can escape a group; no whole-tree claim.
    #[cfg(unix)]
    drop(process_group);
    // Bound cleanup as well; kill_on_drop remains a direct-child fallback.
    if completed.is_err() { let _ = tokio::time::timeout(Duration::from_secs(2), child.kill()).await; }
    let (status, stdout_bytes, stderr_bytes) = completed?;
    // On Unix the group has now been cleaned while its leader was still ours.
    // Only now reap the direct child, preserving its original exit status.
    let status = match status {
        Some(status) => status,
        None => child.wait().await.map_err(|error| format!("Verification process failed: {error}"))?,
    };
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
    #[test]
    fn detects_build_without_accepting_arbitrary_script_ids() {
        let root = std::env::temp_dir().join(format!("axiom-build-detection-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("package.json"), r#"{"scripts":{"build":"node build.mjs","deploy":"must not be selected"}}"#).unwrap();
        let checks = detected_checks(&root).unwrap();
        assert!(checks.iter().any(|check| check.definition.id == "npm:build" && check.args == ["run", "build"]));
        assert!(!checks.iter().any(|check| check.definition.id == "npm:deploy"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn runs_an_owned_configured_build_with_a_real_artifact() {
        let root = std::env::temp_dir().join(format!("axiom-build-execution-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("package.json"), r#"{"private":true,"scripts":{"build":"node build.cjs"}}"#).unwrap();
        std::fs::write(root.join("build.cjs"), "require('node:fs').writeFileSync('build-result.txt','owned build'); console.log('owned build finished');").unwrap();
        let check = detected_checks(&root).unwrap().into_iter().find(|check| check.definition.id == "npm:build").unwrap();
        let result = run_detected_check(&root, check, Duration::from_secs(10)).await.unwrap();
        assert!(result.success);
        assert!(result.output.contains("owned build finished"));
        assert_eq!(std::fs::read_to_string(root.join("build-result.txt")).unwrap(), "owned build");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_changed_or_oversized_prepared_manifest_without_exposing_contents() {
        let root = std::env::temp_dir().join(format!("axiom-manifest-guard-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("package.json");
        std::fs::write(&path, r#"{"scripts":{"test":"original"}}"#).unwrap();
        let prepared = check_configuration(&root, "npm:test").unwrap();
        assert!(verify_check_configuration(&root, "npm:test", &prepared).is_ok());
        std::fs::write(&path, r#"{"scripts":{"test":"PRIVATE_REPLACEMENT_SENTINEL"}}"#).unwrap();
        let error = verify_check_configuration(&root, "npm:test", &prepared).unwrap_err();
        assert!(error.contains("definition changed"));
        assert!(!error.contains("PRIVATE_REPLACEMENT_SENTINEL"));
        std::fs::write(&path, vec![b' '; MAX_CHECK_CONFIGURATION_BYTES as usize + 1]).unwrap();
        assert!(check_configuration(&root, "npm:test").unwrap_err().contains("safety limit"));
        assert!(matches!(detected_checks(&root), Err(error) if error.contains("safety limit")));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_a_replaced_fifo_without_waiting_for_a_writer() {
        use std::os::unix::ffi::OsStrExt;
        let root = std::env::temp_dir().join(format!("axiom-manifest-fifo-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let path = std::ffi::CString::new(root.join("package.json").as_os_str().as_bytes()).unwrap();
        // SAFETY: path is a valid NUL-terminated path in this owned test directory.
        assert_eq!(unsafe { libc::mkfifo(path.as_ptr(), 0o600) }, 0);
        assert!(check_configuration(&root, "npm:test").unwrap_err().contains("regular file"));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn changed_definitions_cannot_consume_prepared_tickets_for_any_supported_manifest() {
        for (check_id, manifest) in [("npm:test", "package.json"), ("cargo:check", "Cargo.toml"), ("swift:test", "Package.swift")] {
            let id = format!("definition-{}", NEXT_RUN.fetch_add(1, Ordering::Relaxed));
            let root = std::env::temp_dir().join(format!("axiom-manifest-ticket-{}-{id}", std::process::id()));
            std::fs::create_dir_all(&root).unwrap();
            std::fs::write(root.join(manifest), b"original definition").unwrap();
            let configuration = check_configuration(&root, check_id).unwrap();
            let (sender, receiver) = watch::channel(false);
            runs().lock().unwrap().insert(id.clone(), OwnedRun {prepared_at: std::time::Instant::now(), root: root.clone(), check_id: check_id.into(), configuration, window: "fixture".into(), sender, receiver: Some(receiver)});
            let _guard = RunGuard(id.clone());
            std::fs::write(root.join(manifest), b"changed definition").unwrap();
            assert!(claim_prepared_run(&root, check_id, &id, "fixture").unwrap_err().contains("definition changed"));
            assert!(runs().lock().unwrap().get(&id).unwrap().receiver.is_some());
            std::fs::write(root.join(manifest), b"original definition").unwrap();
            assert!(claim_prepared_run(&root, check_id, &id, "other-window").unwrap_err().contains("ownership changed"));
            assert!(claim_prepared_run(&root, check_id, &id, "fixture").is_ok());
            assert!(claim_prepared_run(&root, check_id, &id, "fixture").unwrap_err().contains("already started"));
            std::fs::remove_dir_all(root).unwrap();
        }
    }

    #[tokio::test]
    async fn exit_observation_reserves_identity_until_group_cleanup_and_reaping() {
        let mut command = Command::new("/bin/sh");
        command.args(["-c", "exit 0"]).process_group(0).kill_on_drop(true);
        let mut child = command.spawn().unwrap();
        let id = child.id().unwrap();
        let group = OwnedProcessGroup(Some(id));
        tokio::time::timeout(Duration::from_secs(2), wait_for_unreaped_exit(id)).await.unwrap().unwrap();
        assert!(child_exited_without_reaping(id).unwrap());
        assert!(child_exited_without_reaping(id).unwrap());
        drop(group);
        assert!(child.wait().await.unwrap().success());
        assert!(child_exited_without_reaping(id).is_err());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn finder_path_finds_standard_tools_without_changing_explicit_precedence() {
        let value = super::verification_path(Some("/custom/bin:/usr/bin:/bin".into())).unwrap();
        let paths: Vec<_> = std::env::split_paths(&value).collect();
        assert_eq!(paths[0], std::path::PathBuf::from("/custom/bin"));
        for path in ["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/bin"] {
            assert_eq!(paths.iter().filter(|item| item.as_path() == std::path::Path::new(path)).count(), 1);
        }
    }
    #[cfg(target_os = "macos")]
    #[test]
    fn verification_never_searches_the_repository_for_a_shadow_package_manager() {
        for inherited in [None, Some(".:relative/bin::/usr/bin:".into())] {
            let value = super::verification_path(inherited).unwrap();
            let paths: Vec<_> = std::env::split_paths(&value).collect();
            assert!(paths.iter().all(|path| path.is_absolute()));
            assert!(paths.contains(&std::path::PathBuf::from("/usr/local/bin")));
        }
    }

    #[tokio::test]
    async fn cancellation_before_spawn_never_runs_script() {
        let (sender, receiver) = watch::channel(true);
        let result = run_detected_check_cancelable(&std::env::temp_dir(), shell("exit 0"), Duration::from_secs(2), receiver).await;
        assert!(result.unwrap_err().contains("before spawn"));
        drop(sender);
    }
    #[tokio::test]
    async fn cancellation_during_wait_never_returns_success() {
        let (sender, receiver) = watch::channel(false);
        let root = std::env::temp_dir();
        let execution = run_detected_check_cancelable(&root, shell("sleep 0.3; exit 0"), Duration::from_secs(2), receiver);
        let cancel = async { tokio::task::yield_now().await; sender.send_replace(true); };
        let (result, _) = tokio::join!(execution, cancel);
        assert!(result.unwrap_err().contains("canceled"));
    }
    #[tokio::test]
    async fn cancellation_stops_an_owned_descendant_before_it_can_write() {
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root = std::env::temp_dir().join(format!("axiom-descendant-{}-{nonce}", std::process::id()));
        std::fs::create_dir(&root).unwrap();
        let (sender, receiver) = watch::channel(false);
        let execution = run_detected_check_cancelable(&root,
            shell("/bin/sh -c 'printf ready > ready; sleep 0.2; printf leaked > marker' & wait"),
            Duration::from_secs(2), receiver);
        let cancel = async {
            tokio::time::timeout(Duration::from_secs(2), async {
                while !root.join("ready").exists() {
                    tokio::time::sleep(Duration::from_millis(5)).await;
                }
            }).await.expect("Owned descendant did not signal readiness");
            sender.send_replace(true);
        };
        let (result, _) = tokio::join!(execution, cancel);
        // This exceeds the fixture's known 0.2s delayed side effect, rather than
        // adding an arbitrary wait to the application cancellation path.
        tokio::time::sleep(Duration::from_millis(300)).await;
        let leaked = root.join("marker").exists();
        let _ = std::fs::remove_dir_all(root);
        assert!(result.unwrap_err().contains("canceled"));
        assert!(!leaked, "The canceled verification left its owned descendant running");
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
        // Inherited pipes cannot extend the deadline; owned-group cleanup is best effort.
        let result = run_detected_check(&std::env::temp_dir(), shell("sleep 0.3 & exit 0"), Duration::from_millis(40)).await;
        assert!(result.unwrap_err().contains("safety limit"));
    }
    #[tokio::test]
    async fn deadline_bounds_direct_child_and_collectors() {
        let result = run_detected_check(&std::env::temp_dir(), shell("sleep 0.3"), Duration::from_millis(40)).await;
        assert!(result.unwrap_err().contains("safety limit"));
    }
}
