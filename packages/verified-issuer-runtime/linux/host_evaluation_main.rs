//! Nondefault actual daemon entrypoint. No arbitrary command/configuration input.
#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() {
    clock_bound::daemon::host_evaluation::run_fixed().await;
}
