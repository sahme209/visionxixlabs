//! DORMANT source patch module for the pinned daemon crate; not a new executable.
//! Include/wire in the actual daemon only after its reviewed build/provenance and
//! constructor/clock-adjustment/native qualification gates pass. No Cargo or
//! default daemon/HTTP registration is supplied by this local preparation.
#![cfg(all(target_os = "linux", target_pointer_width = "64"))]
use crate::shm::{ClockErrorBound, ClockStatus, ShmWrite};
use std::ffi::{CString, c_char, c_int};
use std::os::fd::{AsRawFd, OwnedFd};
use std::panic::{catch_unwind, AssertUnwindSafe};

#[repr(C)]
struct AxiomTimeContext {
    directory_fd: c_int,
    source_fd: c_int,
    publisher_uid: u32,
    reader_gid: u32,
    directory_device: u64,
    directory_inode: u64,
}
unsafe extern "C" {
    fn axiom_time_publish_or_die(context: *const AxiomTimeContext, generation: *const c_char,
        publication: u64, bytes: *const u8, length: usize);
}
fn fatal() -> ! { std::process::abort() }
fn nanos(seconds: i128, fraction: i128) -> Option<u64> {
    if seconds < 0 || !(0..1_000_000_000).contains(&fraction) { return None; }
    let value = seconds.checked_mul(1_000_000_000)?.checked_add(fraction)?;
    if value > i64::MAX as i128 { return None; }
    u64::try_from(value).ok()
}
fn generation_ok(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}
fn encode(value: &ClockErrorBound, generation: &str, counter: u64) -> Option<Vec<u8>> {
    if !matches!(value, ClockErrorBound::V2(_)) || !generation_ok(generation) || counter == 0 { return None; }
    let a = value.as_of(); let v = value.void_after();
    let as_of = nanos(a.tv_sec() as i128, a.tv_nsec() as i128)?;
    let void_after = nanos(v.tv_sec() as i128, v.tv_nsec() as i128)?;
    let bound = value.bound_nsec(); let drift = value.max_drift_ppb();
    if void_after <= as_of || bound < 0 || drift >= 1_000_000_000 { return None; }
    let status = match value.clock_status() {
        ClockStatus::Unknown => "unknown", ClockStatus::Synchronized => "synchronized",
        ClockStatus::FreeRunning => "free-running", ClockStatus::Disrupted => "disrupted",
    };
    let flag = if value.clock_disruption_support_enabled() { "1" } else { "0" };
    let record = format!("AXIOM_TIME_V1\nclockbound-v2\n{generation}\n{counter}\n{as_of}\n{void_after}\n{bound}\n{drift}\n{status}\n{}\n{flag}\nEND\n", value.disruption_marker()).into_bytes();
    if record.len() > 4096 { return None; }
    Some(record)
}
/// Resource identity is not attestation. The actual private constructor must
/// qualify and transfer a NEW generation directory and the fixed daemon hook;
/// caller JSON/environment cannot construct the production source context.
pub struct NativeTimePublisher {
    _directory: OwnedFd,
    context: AxiomTimeContext,
    generation: CString,
    counter: u64,
    initialized_unknown: bool,
    delegate: Box<dyn ShmWrite + Send + Sync>,
}
impl NativeTimePublisher {
    pub fn new(directory: OwnedFd, generation: String, publisher_uid: u32, reader_gid: u32,
        directory_device: u64, directory_inode: u64, delegate: Box<dyn ShmWrite + Send + Sync>) -> Self {
        if !generation_ok(&generation) { fatal(); }
        let context = AxiomTimeContext { directory_fd: directory.as_raw_fd(), source_fd: -1,
            publisher_uid, reader_gid, directory_device, directory_inode };
        Self { _directory: directory, context, generation: CString::new(generation).unwrap_or_else(|_| fatal()),
            counter: 0, initialized_unknown: false, delegate }
    }
}
impl ShmWrite for NativeTimePublisher {
    fn write(&mut self, value: &ClockErrorBound) {
        if !self.initialized_unknown && value.clock_status() != ClockStatus::Unknown { fatal(); }
        self.counter = self.counter.checked_add(1).unwrap_or_else(|| fatal());
        let generation = self.generation.to_str().unwrap_or_else(|_| fatal());
        let record = encode(value, generation, self.counter).unwrap_or_else(|| fatal());
        // SAFETY: owned context/strings/record remain alive for the synchronous
        // fixed C call. Failure exits before delegate/caller continuation.
        unsafe { axiom_time_publish_or_die(&self.context, self.generation.as_ptr(), self.counter, record.as_ptr(), record.len()); }
        if catch_unwind(AssertUnwindSafe(|| self.delegate.write(value))).is_err() { fatal(); }
        self.initialized_unknown = true;
    }
}
