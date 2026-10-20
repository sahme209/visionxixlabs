//! Real reqwest -> TCP -> Tauri Channel fixtures. No hosted provider or webview.
//! These are intentionally not ignored if loopback/tooling is unavailable: CI
//! must supply that capability; source preparation is not native acceptance.
use super::{pump_stream_at, until_cancelled, Channel, DesktopHttpRequest, DesktopStreamEvent, StreamEndpoint, STREAM_CHUNK_BYTES, STREAM_TOTAL_BYTES};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
use std::time::Duration;
use tauri::ipc::InvokeResponseBody;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, oneshot};
use tokio::task::JoinHandle;
use tokio::time::timeout;

const WAIT: Duration = Duration::from_secs(5);
const PATH: &str = "/api/desktop/agent/conversations/fixture/messages";
fn request() -> DesktopHttpRequest {
    DesktopHttpRequest {
        method: "POST".to_string(), path: PATH.to_string(), body: Some("{}".to_string()),
        headers: HashMap::from([
            ("authorization".to_string(), "Bearer synthetic-wire-fixture".to_string()),
            ("accept".to_string(), "application/x-ndjson".to_string()),
            ("content-type".to_string(), "application/json".to_string()),
            ("x-never-forward".to_string(), "synthetic-forbidden-header".to_string()),
        ]),
    }
}
fn channel() -> (Channel<DesktopStreamEvent>, mpsc::UnboundedReceiver<Value>) {
    let (sender, receiver) = mpsc::unbounded_channel();
    (Channel::new(move |body| {
        let InvokeResponseBody::Json(json) = body else { panic!("Expected serialized stream event"); };
        sender.send(serde_json::from_str(&json).expect("stream event JSON")).expect("live fixture receiver");
        Ok(())
    }), receiver)
}
async fn event(receiver: &mut mpsc::UnboundedReceiver<Value>) -> Value {
    timeout(WAIT, receiver.recv()).await.expect("stream event deadline").expect("stream event channel closed")
}
async fn complete(worker: JoinHandle<Result<(), ()>>) -> Result<(), ()> {
    timeout(WAIT, worker).await.expect("native worker deadline").expect("native worker panicked")
}
fn worker(address: std::net::SocketAddr, channel: Channel<DesktopStreamEvent>, acknowledge: mpsc::Receiver<u64>, cancel: oneshot::Receiver<()>) -> JoinHandle<Result<(), ()>> {
    tokio::spawn(async move {
        until_cancelled(pump_stream_at(request(), &channel, acknowledge, StreamEndpoint::Loopback(address)), cancel).await
    })
}
async fn listener() -> (TcpListener, std::net::SocketAddr) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("loopback fixture bind");
    let address = listener.local_addr().expect("loopback fixture address");
    (listener, address)
}
async fn read_request(socket: &mut TcpStream) -> Vec<u8> {
    let mut received = Vec::new();
    loop {
        let mut bytes = [0u8; 1024];
        let length = timeout(WAIT, socket.read(&mut bytes)).await.expect("request read deadline").expect("request read");
        assert!(length > 0, "request ended before its body");
        received.extend_from_slice(&bytes[..length]);
        assert!(received.len() <= 16 * 1024, "fixture request bound");
        if let Some(end) = received.windows(4).position(|value| value == b"\r\n\r\n") {
            if received.len() >= end + 4 + 2 { return received; }
        }
    }
}
async fn chunk(socket: &mut TcpStream, bytes: &[u8]) {
    socket.write_all(format!("{:x}\r\n", bytes.len()).as_bytes()).await.expect("chunk size");
    socket.write_all(bytes).await.expect("chunk bytes");
    socket.write_all(b"\r\n").await.expect("chunk separator");
}
const CHUNKED_HEADERS: &[u8] = b"HTTP/1.1 200 OK\r\ncontent-type: application/x-ndjson\r\ntransfer-encoding: chunked\r\nconnection: close\r\n\r\n";

#[tokio::test]
async fn real_wire_delivers_incrementally_preserves_split_utf8_and_waits_for_ack() {
    let (listener, address) = listener().await;
    let (release, released) = oneshot::channel();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("fixture accept");
        let request = read_request(&mut socket).await;
        socket.write_all(CHUNKED_HEADERS).await.expect("response headers");
        chunk(&mut socket, &[0xe2]).await;
        released.await.expect("release second network fragment");
        chunk(&mut socket, &[0x82, 0xac]).await;
        socket.write_all(b"0\r\n\r\n").await.expect("response end");
        request
    });
    let (channel, mut events) = channel();
    let (ack, acknowledged) = mpsc::channel(1);
    let (_cancel, canceled) = oneshot::channel();
    let task = worker(address, channel, acknowledged, canceled);
    assert_eq!(event(&mut events).await["kind"], "headers");
    let first = event(&mut events).await;
    assert_eq!(first, json!({ "kind": "chunk", "sequence": 0, "bytes": [0xe2] }));
    // The server has not emitted the rest of the UTF-8 character or finished;
    // seeing this first event proves that the native path did not buffer text.
    release.send(()).expect("release response");
    let received = timeout(WAIT, server).await.expect("server deadline").expect("server task");
    assert!(timeout(Duration::from_millis(25), events.recv()).await.is_err(), "no second IPC chunk before demand acknowledgement");
    assert!(!task.is_finished(), "worker must still wait for acknowledgement");
    ack.send(0).await.expect("first ack");
    // HTTP readers may split the remaining network fragment at any byte.
    // Verify the reconstructed bytes, not an assumed TCP packet boundary.
    let mut bytes = vec![0xe2];
    let mut sequence = 1;
    while bytes.len() < 3 {
        let next = event(&mut events).await;
        assert_eq!(next["kind"], "chunk");
        assert_eq!(next["sequence"], sequence);
        bytes.extend(next["bytes"].as_array().expect("bytes").iter().map(|n| n.as_u64().expect("byte") as u8));
        ack.send(sequence).await.expect("fragment ack");
        sequence += 1;
    }
    assert!(complete(task).await.is_ok());
    assert_eq!(String::from_utf8(bytes).expect("preserved UTF-8"), "€");
    let received = String::from_utf8(received).expect("request UTF-8").to_ascii_lowercase();
    assert!(received.starts_with(&format!("post {PATH} http/1.1")));
    assert!(received.contains("authorization: bearer synthetic-wire-fixture"));
    assert!(!received.contains("x-never-forward"));
    assert!(!received.contains("synthetic-forbidden-header"));
}

#[tokio::test]
async fn real_wire_cancellation_drops_a_stalled_http_body_and_closes_its_socket() {
    let (listener, address) = listener().await;
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("fixture accept");
        read_request(&mut socket).await;
        socket.write_all(CHUNKED_HEADERS).await.expect("response headers");
        let mut byte = [0u8; 1];
        let result = timeout(WAIT, socket.read(&mut byte)).await.expect("canceled socket must close");
        assert!(match result {
            Ok(0) => true,
            Err(error) => matches!(error.kind(), std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::ConnectionAborted | std::io::ErrorKind::BrokenPipe),
            _ => false,
        }, "canceled request must close its socket");
    });
    let (channel, mut events) = channel();
    let (_ack, acknowledged) = mpsc::channel(1);
    let (cancel, canceled) = oneshot::channel();
    let task = worker(address, channel, acknowledged, canceled);
    assert_eq!(event(&mut events).await["kind"], "headers");
    cancel.send(()).expect("cancel stalled read");
    assert!(complete(task).await.is_err());
    timeout(WAIT, server).await.expect("socket-close deadline").expect("server task");
    assert!(events.try_recv().is_err(), "canceled stream must not fabricate data");
}

#[tokio::test]
async fn real_wire_wrong_ack_fails_instead_of_reading_a_second_chunk() {
    let (listener, address) = listener().await;
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("fixture accept");
        read_request(&mut socket).await;
        socket.write_all(b"HTTP/1.1 200 OK\r\ncontent-type: application/x-ndjson\r\ncontent-length: 1\r\nconnection: close\r\n\r\nx").await.expect("fixture response");
    });
    let (channel, mut events) = channel();
    let (ack, acknowledged) = mpsc::channel(1);
    let (_cancel, canceled) = oneshot::channel();
    let task = worker(address, channel, acknowledged, canceled);
    assert_eq!(event(&mut events).await["kind"], "headers");
    assert_eq!(event(&mut events).await["sequence"], 0);
    ack.send(99).await.expect("wrong ack");
    assert!(complete(task).await.is_err());
    timeout(WAIT, server).await.expect("server deadline").expect("server task");
}

#[tokio::test]
async fn real_wire_refuses_redirects_without_connecting_to_the_location() {
    let (listener, address) = listener().await;
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("fixture accept");
        read_request(&mut socket).await;
        socket.write_all(format!("HTTP/1.1 302 Found\r\nlocation: http://{address}/redirected\r\ncontent-length: 0\r\nconnection: close\r\n\r\n").as_bytes()).await.expect("redirect response");
        listener
    });
    let (channel, mut events) = channel();
    let (_ack, acknowledged) = mpsc::channel(1);
    let (_cancel, canceled) = oneshot::channel();
    assert!(complete(worker(address, channel, acknowledged, canceled)).await.is_err());
    let listener = timeout(WAIT, server).await.expect("server deadline").expect("server task");
    assert!(timeout(Duration::from_millis(50), listener.accept()).await.is_err(), "redirect destination was contacted");
    assert!(events.try_recv().is_err(), "redirect must not expose a successful header event");
}

#[tokio::test]
async fn real_wire_bounds_total_bytes_and_each_ipc_chunk() {
    let (listener, address) = listener().await;
    let (release_extra, extra_released) = oneshot::channel();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("fixture accept");
        read_request(&mut socket).await;
        socket.write_all(format!("HTTP/1.1 200 OK\r\ncontent-type: application/x-ndjson\r\ncontent-length: {}\r\nconnection: close\r\n\r\n", STREAM_TOTAL_BYTES + 1).as_bytes()).await.expect("response headers");
        let bytes = vec![b'x'; STREAM_CHUNK_BYTES];
        for _ in 0..(STREAM_TOTAL_BYTES / STREAM_CHUNK_BYTES) {
            if socket.write_all(&bytes).await.is_err() { return; }
        }
        extra_released.await.expect("release byte beyond the limit");
        let _ = socket.write_all(b"x").await; // client may close when the cap is exceeded
    });
    let delivered = Arc::new(AtomicUsize::new(0));
    let count = delivered.clone();
    let (at_limit, mut limit_reached) = mpsc::unbounded_channel();
    let (ack, acknowledged) = mpsc::channel(1);
    let channel = Channel::new(move |body| {
        let InvokeResponseBody::Json(body) = body else { panic!("Expected JSON event"); };
        let value: Value = serde_json::from_str(&body).expect("stream event JSON");
        if value["kind"] == "chunk" {
            let bytes = value["bytes"].as_array().expect("chunk bytes");
            assert!(bytes.len() <= STREAM_CHUNK_BYTES);
            let total = count.fetch_add(bytes.len(), Ordering::SeqCst) + bytes.len();
            if total == STREAM_TOTAL_BYTES { at_limit.send(()).expect("limit observer"); }
            ack.try_send(value["sequence"].as_u64().expect("sequence")).expect("one outstanding chunk");
        }
        Ok(())
    });
    let (_cancel, canceled) = oneshot::channel();
    let task = worker(address, channel, acknowledged, canceled);
    timeout(WAIT, limit_reached.recv()).await.expect("full permitted stream deadline").expect("limit event");
    release_extra.send(()).expect("release excess byte");
    assert!(complete(task).await.is_err());
    assert_eq!(delivered.load(Ordering::SeqCst), STREAM_TOTAL_BYTES);
    timeout(WAIT, server).await.expect("server deadline").expect("server task");
}

#[test]
fn alternate_endpoints_are_test_only_and_loopback_only() {
    assert!(StreamEndpoint::Loopback("192.0.2.1:80".parse().expect("test address")).url(PATH).is_err());
    assert!(StreamEndpoint::Loopback("127.0.0.1:1".parse().expect("loopback address")).url("/arbitrary").is_err());
    assert_eq!(StreamEndpoint::Product.url(PATH).expect("product URL"), format!("https://visionxixlabs.com{PATH}"));
}
