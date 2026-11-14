//! Fixed isolated host evaluation. No accepted policy or credential supplier.
use super::time_publication_adapter::NativeTimePublisherContext;
use super::Daemon;
use std::fs::{self, File};
use std::os::fd::{AsRawFd, FromRawFd};
use std::os::unix::fs::MetadataExt;
use tokio::signal::unix::{signal, SignalKind};
use tokio_util::sync::CancellationToken;

fn refuse() -> ! {
    eprintln!("{{\"format\":1,\"event\":\"producer_resource_refused\"}}");
    std::process::exit(70)
}
fn owned_directory(path: &str, mode: u32) -> fs::Metadata {
    let value = fs::symlink_metadata(path).unwrap_or_else(|_| refuse());
    if !value.is_dir() || value.uid() != 0 || value.mode() & 0o7777 != mode {
        refuse();
    }
    value
}

/// Called only by the separately built fixed evaluation binary; no CLI inputs.
pub async fn run_fixed() {
    if std::env::args_os().count() != 1 || unsafe { libc::getuid() } != 0 {
        refuse();
    }
    let run = fs::symlink_metadata("/run").unwrap_or_else(|_| refuse());
    if !run.is_dir() || run.uid() != 0 || run.mode() & 0o022 != 0 { refuse(); }
    owned_directory("/run/axiom-host-evaluation", 0o750);
    owned_directory("/run/axiom-host-evaluation/compat", 0o700);
    let path = owned_directory("/run/axiom-host-evaluation/generation-1", 0o750);
    if path.gid() == 0 { refuse(); }
    // The fixed bootstrap alone passes this owned read-only directory as FD3.
    let directory = unsafe { File::from_raw_fd(3) };
    let value = directory.metadata().unwrap_or_else(|_| refuse());
    let flags = unsafe { libc::fcntl(directory.as_raw_fd(), libc::F_GETFL) };
    if flags < 0 || flags & libc::O_ACCMODE != libc::O_RDONLY
        || value.dev() != path.dev() || value.ino() != path.ino() { refuse(); }
    let context = NativeTimePublisherContext::from_protected_resource(
        directory.into(), "host-evaluation-1".to_owned(), 0, path.gid(), path.dev(), path.ino(),
    );
    let cancellation = CancellationToken::new();
    let mut terminate = signal(SignalKind::terminate()).unwrap_or_else(|_| refuse());
    let daemon = Daemon::construct_host_evaluation(cancellation.clone(), context).await;
    println!("{{\"format\":1,\"event\":\"producer_started\",\"strictTimeAuthority\":false,\"vmclockSupport\":false}}");
    let mut task = tokio::spawn(Box::new(daemon).run_host_evaluation());
    tokio::select! {
        _ = terminate.recv() => (),
        _ = tokio::time::sleep(tokio::time::Duration::from_secs(90)) => (),
        result = &mut task => {
            let _ = result;
            eprintln!("{{\"format\":1,\"event\":\"producer_unexpected_exit\"}}");
            std::process::exit(70);
        }
    }
    cancellation.cancel();
    match tokio::time::timeout(tokio::time::Duration::from_secs(5), task).await {
        Ok(Ok(())) => println!("{{\"format\":1,\"event\":\"producer_stopped\"}}"),
        _ => refuse(),
    }
}
