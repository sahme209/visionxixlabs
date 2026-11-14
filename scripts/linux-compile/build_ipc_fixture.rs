//! Trusted build-only compatibility fixture; never a Governance runtime.
use std::io::ErrorKind;
use std::os::unix::process::CommandExt;
use std::path::{Path,PathBuf};
use std::process::{Child,Command,Stdio};
use std::time::{Duration,Instant};
const TOOL:&str="/usr/bin/true";
const WAIT_LIMIT:Duration=Duration::from_millis(1000);
fn fail()->! {
    eprintln!("build-ipc-rust:failed");
    // Outer original-group supervisor owns uncertain descendants. Do not kill,
    // reuse a PID, or start the next fixture operation after uncertainty.
    std::process::exit(70);
}
fn wait(mut child:Child)->bool {
    let started=Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status))=>return status.success(),
            Ok(None)=>{},
            Err(_)=>fail(),
        }
        if started.elapsed()>=WAIT_LIMIT { fail(); }
        std::thread::sleep(Duration::from_millis(5));
    }
}
fn preexec_command(path:&Path)->Command {
    let mut command=Command::new(path);
    command.stdin(Stdio::inherit()).stdout(Stdio::inherit()).stderr(Stdio::inherit());
    // SAFETY: constant-success no-op only; no locks, allocation, I/O, identity,
    // environment or process-group modifications occur after the fork.
    unsafe { command.pre_exec(|| Ok(())); }
    command
}
fn missing_target(args:Vec<std::ffi::OsString>)->PathBuf {
    if args.len()!=3 || args[1]!=TOOL { fail(); }
    let target=PathBuf::from(&args[2]);
    if !target.is_absolute() || target.file_name()!=Some(std::ffi::OsStr::new("build-ipc-missing-executable")) { fail(); }
    let parent=target.parent().unwrap_or_else(||fail());
    if parent.file_name()!=Some(std::ffi::OsStr::new("native")) { fail(); }
    let metadata=parent.symlink_metadata().unwrap_or_else(|_|fail());
    if !metadata.is_dir() || metadata.file_type().is_symlink() { fail(); }
    match target.symlink_metadata() {
        Err(error) if error.kind()==ErrorKind::NotFound=>{},
        _=>fail(),
    }
    target
}
fn main() {
    let absent=missing_target(std::env::args_os().collect());
    // Actual std captured-output code must configure and collect BOTH pipes.
    // Its internal wait/output operation stays within the external5s budget.
    let output=Command::new(TOOL).stdin(Stdio::inherit())
        .stdout(Stdio::piped()).stderr(Stdio::piped()).output().unwrap_or_else(|_|fail());
    if !output.status.success() || !output.stdout.is_empty() || !output.stderr.is_empty() { fail(); }
    let mut command=preexec_command(Path::new(TOOL));
    let child=command.spawn().unwrap_or_else(|_|fail());
    if !wait(child) { fail(); }
    let mut command=preexec_command(&absent);
    match command.spawn() {
        Err(error) if error.kind()==ErrorKind::NotFound=>{},
        Err(_)=>fail(),
        Ok(child)=>{ let _=wait(child);fail(); },
    }
    println!("build-ipc-rust:ok");
}
