//! Trusted dependency-free diagnostic only. No native run occurred in preparation.
use std::os::unix::process::CommandExt;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
const TOOL: &str = "/usr/bin/true";
const WAIT_LIMIT: Duration = Duration::from_millis(1000);
fn stop(label: &str, category: &str) -> ! {
    println!("{label}:{category}");
    // Exit without dropping/reassigning an uncertain Child. The original outer
    // supervisor retains its leader/group and owns bounded descendant cleanup.
    std::process::exit(70);
}
fn run_path(label: &str, preexec: bool) {
    let mut command = Command::new(TOOL);
    command.stdin(Stdio::inherit()).stdout(Stdio::inherit()).stderr(Stdio::inherit());
    if preexec {
        // SAFETY: the only post-fork closure returns a constant success. It does
        // no allocation, locks, I/O, environment/identity or process-group work.
        unsafe { command.pre_exec(|| Ok(())); }
    }
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            match error.raw_os_error() {
                Some(code) => println!("{label}:spawn-error:{code}"),
                None => println!("{label}:spawn-error:unknown"),
            }
            return; // No Child/PID exists; do not invent one or retry.
        }
    };
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                println!("{label}:{}", if status.success() { "exit-ok" } else { "exit-failed" });
                return;
            }
            Ok(None) => {}
            Err(_) => stop(label, "wait-error"),
        }
        if started.elapsed() >= WAIT_LIMIT { stop(label, "wait-timeout"); }
        std::thread::sleep(Duration::from_millis(5));
    }
}
fn main() {
    run_path("ordinary", false);
    run_path("preexec", true);
}
