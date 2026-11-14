//! Distinct operational status. No physical bound/rate/strict policy is minted.
//! The fixed operational main is the only caller: inherited original FD8/11/12
//! are delivered by its administrative owner. Stock constructors never call it.
use crate::daemon::time::clocks::{PreciseOrigin, OriginSourceKind};
use crate::shm::{ClockErrorBound, ClockStatus};
unsafe extern "C" {
    fn axiom_operational_daemon_initialize() -> i32;
    fn axiom_operational_daemon_publish(publication: u64, marker: u64, state: u32) -> i32;
}
#[derive(Clone, Copy)]
enum State { Unknown = 0, Ready = 1, Disrupted = 2, Withdrawn = 3 }
pub(crate) struct OperationalPublisherState { first: bool, last: u64 }
impl OperationalPublisherState {
    pub(crate) fn from_original_owner() -> Self {
        // Native initialize checks original protected acceptance + anonymous
        // descriptors, current boot and fixed-source resource identity.
        if unsafe { axiom_operational_daemon_initialize() } != 0 { std::process::abort(); }
        Self { first: true, last: 0 }
    }
    fn acknowledge(&mut self, publication: u64, marker: u64, state: State) {
        if publication == 0 || publication <= self.last || self.first && !matches!(state, State::Unknown) {
            std::process::abort();
        }
        if unsafe { axiom_operational_daemon_publish(publication, marker, state as u32) } != 0 {
            // Never continue adjusting or expose Ready after lost status ACK.
            std::process::abort();
        }
        self.first = false;
        self.last = publication;
    }
    pub(crate) fn invalidate(&mut self, publication: u64, value: &ClockErrorBound) {
        let state = if !self.first && value.clock_status() == ClockStatus::Disrupted {
            State::Disrupted
        } else { State::Unknown };
        self.acknowledge(publication, value.disruption_marker(), state);
    }
    pub(crate) fn publication_acknowledged(&mut self, publication: u64,
        origin: Option<&PreciseOrigin>, value: &ClockErrorBound) {
        // Called ONLY after original strict immutable-publication ACK. Strict
        // record may remain Unknown; readiness uses original selected value.
        let ready = origin.is_some_and(|o| o.kind == OriginSourceKind::Ntp &&
            o.counter_pre >= 0 && o.counter_post > o.counter_pre) &&
            value.clock_status() == ClockStatus::Synchronized;
        self.acknowledge(publication, value.disruption_marker(),
            if ready { State::Ready } else { State::Unknown });
    }
    pub(crate) fn withdraw(&mut self, publication: u64, marker: u64) {
        self.acknowledge(publication, marker, State::Withdrawn);
    }
}

/// Fixed, nondefault production-operational entry. No strict policy is supplied.
/// Original installed profile and current host acceptance are the owner's task.
#[cfg(feature = "axiom-operational-time")]
pub async fn run_fixed() {
    use std::fs::File;
    use std::io::Read;
    use std::os::fd::FromRawFd;
    use std::os::unix::fs::MetadataExt;
    use tokio::signal::unix::{signal, SignalKind};
    use tokio_util::sync::CancellationToken;
    fn refuse() -> ! { std::process::exit(70) }
    if std::env::args_os().count() != 1 || unsafe { libc::getuid() } != 0 { refuse(); }
    let acceptance_fd = unsafe { libc::fcntl(8, libc::F_DUPFD_CLOEXEC, 16) };
    if acceptance_fd < 0 { refuse(); }
    let acceptance = unsafe { File::from_raw_fd(acceptance_fd) };
    let mut bytes = Vec::new();
    acceptance.take(4097).read_to_end(&mut bytes).unwrap_or_else(|_| refuse());
    if bytes.len() > 4096 { refuse(); }
    let text = std::str::from_utf8(&bytes).unwrap_or_else(|_| refuse());
    let lines: Vec<&str> = text.split('\n').collect();
    if lines.len() != 12 || lines[0] != "AXIOM_ACCEPT_V1" || lines[10] != "END" || lines[11] != "" { refuse(); }
    let generation = lines[4].to_owned();
    let directory = unsafe { File::from_raw_fd(3) };
    let held = directory.metadata().unwrap_or_else(|_| refuse());
    let named = std::fs::symlink_metadata("/run/axiom-operational-time/generation-1").unwrap_or_else(|_| refuse());
    if !held.is_dir() || held.uid() != 0 || held.mode() & 0o7777 != 0o750 || held.gid() == 0 || held.dev() != named.dev() || held.ino() != named.ino() { refuse(); }
    let state = OperationalPublisherState::from_original_owner();
    let context = super::time_publication_adapter::NativeTimePublisherContext::from_protected_resource(
        directory.into(), generation, 0, held.gid(), held.dev(), held.ino()
    ).with_operational(state);
    let cancellation = CancellationToken::new();
    let mut terminate = signal(SignalKind::terminate()).unwrap_or_else(|_| refuse());
    let daemon = super::Daemon::construct_operational(cancellation.clone(), context).await;
    let mut task = tokio::spawn(Box::new(daemon).run_operational());
    tokio::select! { _ = terminate.recv() => (), _ = &mut task => refuse() }
    cancellation.cancel();
    match tokio::time::timeout(tokio::time::Duration::from_secs(5), task).await {
        Ok(Ok(())) => (), _ => refuse()
    }
}
