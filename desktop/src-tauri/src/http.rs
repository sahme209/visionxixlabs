use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::ipc::Channel;
use tokio::sync::{mpsc, oneshot};
use std::time::Duration;

const API_ORIGIN: &str = "https://visionxixlabs.com";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHttpRequest {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHttpResponse {
    status: u16,
    body: String,
    headers: HashMap<String, String>,
}

fn validated_url(path: &str) -> Result<String, String> {
    if !path.starts_with("/api/") || path.contains("\\") || path.contains("\n") || path.contains("\r") {
        return Err("Only Vision XIX Labs API paths are allowed.".to_string());
    }
    Ok(format!("{API_ORIGIN}{path}"))
}

fn allowed_method(method: &reqwest::Method) -> bool {
    method == reqwest::Method::GET
        || method == reqwest::Method::POST
        || method == reqwest::Method::PUT
        || method == reqwest::Method::DELETE
}

#[tauri::command]
pub async fn desktop_http_request(request: DesktopHttpRequest) -> Result<DesktopHttpResponse, String> {
    let url = validated_url(&request.path)?;
    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| "Unsupported HTTP method.".to_string())?;
    if !allowed_method(&method) {
        return Err("Only GET, POST, PUT, and DELETE requests are allowed.".to_string());
    }

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(35))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "The secure network client could not be initialized.".to_string())?;

    let mut builder = client.request(method, url);
    for (name, value) in request.headers {
        let normalized = name.to_ascii_lowercase();
        if matches!(normalized.as_str(), "accept" | "authorization" | "content-type" | "idempotency-key") {
            builder = builder.header(name, value);
        }
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }

    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            "The service did not respond in time. No success was assumed; try again after checking connectivity.".to_string()
        } else if error.is_connect() {
            "The service could not be reached. Check your connection and try again.".to_string()
        } else {
            "The service request failed before a verified response was received.".to_string()
        }
    })?;

    let status = response.status().as_u16();
    let mut headers = HashMap::new();
    for name in ["content-type", "retry-after", "x-correlation-id"] {
        if let Some(value) = response.headers().get(name).and_then(|value| value.to_str().ok()) {
            headers.insert(name.to_string(), value.to_string());
        }
    }
    let body = response.text().await.map_err(|_| "The service returned an unreadable response.".to_string())?;
    Ok(DesktopHttpResponse { status, body, headers })
}

// One bounded IPC chunk may be outstanding until the webview consumes it.
const STREAM_CHUNK_BYTES: usize = 16 * 1024;
const STREAM_TOTAL_BYTES: usize = 8 * 1024 * 1024;
const STREAM_MAX_GLOBAL: usize = 4;
const STREAM_MAX_WINDOW: usize = 2;

struct StreamControl {
    cancel: Option<oneshot::Sender<()>>,
    acknowledge: mpsc::Sender<u64>,
}
type StreamKey = (String, String);
static STREAMS: OnceLock<Mutex<HashMap<StreamKey, StreamControl>>> = OnceLock::new();
fn streams() -> &'static Mutex<HashMap<StreamKey, StreamControl>> {
    STREAMS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DesktopStreamEvent {
    Headers { status: u16, headers: HashMap<String, String> },
    Chunk { sequence: u64, bytes: Vec<u8> },
    End,
    Error,
}

fn valid_stream_id(value: &str) -> bool {
    (16..=64).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn stream_path(path: &str) -> bool {
    let Some(id) = path.strip_prefix("/api/desktop/agent/conversations/").and_then(|p| p.strip_suffix("/messages")) else { return false; };
    !id.is_empty() && id.len() <= 200 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn validate_stream_request(request: &DesktopHttpRequest) -> Result<(), String> {
    let bearer = request.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case("authorization")).map(|(_, v)| v.as_str());
    let accept = request.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case("accept")).map(|(_, v)| v.as_str());
    if request.method != "POST" || !stream_path(&request.path)
        || accept != Some("application/x-ndjson")
        || !bearer.is_some_and(|v| v.starts_with("Bearer ") && v.len() > 7 && v.len() <= 4096)
        || request.body.as_ref().is_none_or(|v| v.len() > 512 * 1024)
    {
        return Err("The authenticated Agent streaming request is invalid.".to_string());
    }
    Ok(())
}

/// A synchronous registration acknowledgement closes the cancel-before-start
/// race. All controls are keyed by the invoking webview, never a caller label.
#[tauri::command]
pub fn desktop_http_stream(
    window: tauri::WebviewWindow,
    request: DesktopHttpRequest,
    request_id: String,
    on_event: Channel<DesktopStreamEvent>,
) -> Result<(), String> {
    validate_stream_request(&request)?;
    if !valid_stream_id(&request_id) { return Err("Invalid stream identity.".to_string()); }
    let key = (window.label().to_string(), request_id);
    let (cancel, cancel_rx) = oneshot::channel();
    let (acknowledge, ack_rx) = mpsc::channel(1);
    {
        let mut active = streams().lock().map_err(|_| "Streaming is unavailable.".to_string())?;
        if active.contains_key(&key) || active.len() >= STREAM_MAX_GLOBAL
            || active.keys().filter(|k| k.0 == key.0).count() >= STREAM_MAX_WINDOW
        { return Err("Too many active Agent streams.".to_string()); }
        active.insert(key.clone(), StreamControl { cancel: Some(cancel), acknowledge });
    }
    // Explicitly detach; cancellation is owned by the bounded registry above.
    std::mem::drop(tauri::async_runtime::spawn(async move {
        let work = pump_stream(request, &on_event, ack_rx);
        tokio::pin!(work);
        let result = tokio::select! {
            result = &mut work => result,
            _ = cancel_rx => Err(()),
            _ = tokio::time::sleep(Duration::from_secs(120)) => Err(()),
        };
        // Drop of the losing HTTP future closes the body and socket. Channel
        // errors are fixed labels: never expose reqwest errors or credentials.
        let _ = on_event.send(if result.is_ok() { DesktopStreamEvent::End } else { DesktopStreamEvent::Error });
        if let Ok(mut active) = streams().lock() { active.remove(&key); }
    }));
    Ok(())
}

#[tauri::command]
pub fn desktop_http_stream_cancel(window: tauri::WebviewWindow, request_id: String) -> Result<(), String> {
    let mut active = streams().lock().map_err(|_| "Streaming is unavailable.".to_string())?;
    if let Some(control) = active.get_mut(&(window.label().to_string(), request_id)) {
        if let Some(cancel) = control.cancel.take() { let _ = cancel.send(()); }
    }
    Ok(())
}

#[tauri::command]
pub fn desktop_http_stream_ack(window: tauri::WebviewWindow, request_id: String, sequence: u64) -> Result<(), String> {
    let active = streams().lock().map_err(|_| "Streaming is unavailable.".to_string())?;
    let control = active.get(&(window.label().to_string(), request_id)).ok_or_else(|| "Stream is closed.".to_string())?;
    control.acknowledge.try_send(sequence).map_err(|_| "Stream acknowledgement refused.".to_string())
}

async fn pump_stream(request: DesktopHttpRequest, channel: &Channel<DesktopStreamEvent>, mut acknowledge: mpsc::Receiver<u64>) -> Result<(), ()> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|_| ())?;
    let mut builder = client.post(validated_url(&request.path).map_err(|_| ())?);
    for (name, value) in request.headers {
        if matches!(name.to_ascii_lowercase().as_str(), "accept" | "authorization" | "content-type" | "idempotency-key") {
            builder = builder.header(name, value);
        }
    }
    let mut response = builder.body(request.body.unwrap_or_default()).send().await.map_err(|_| ())?;
    if response.status().is_redirection() { return Err(()); }
    let mut headers = HashMap::new();
    for name in ["content-type", "retry-after", "x-correlation-id"] {
        if let Some(value) = response.headers().get(name).and_then(|v| v.to_str().ok()) { headers.insert(name.to_string(), value.to_string()); }
    }
    channel.send(DesktopStreamEvent::Headers { status: response.status().as_u16(), headers }).map_err(|_| ())?;
    let mut total = 0usize;
    let mut sequence = 0u64;
    while let Some(chunk) = response.chunk().await.map_err(|_| ())? {
        total = total.checked_add(chunk.len()).ok_or(())?;
        if total > STREAM_TOTAL_BYTES { return Err(()); }
        for bytes in chunk.chunks(STREAM_CHUNK_BYTES) {
            channel.send(DesktopStreamEvent::Chunk { sequence, bytes: bytes.to_vec() }).map_err(|_| ())?;
            if acknowledge.recv().await != Some(sequence) { return Err(()); }
            sequence += 1;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{allowed_method, validated_url, valid_stream_id, stream_path, validate_stream_request, DesktopHttpRequest};
    use std::collections::HashMap;

    #[test]
    fn restricts_requests_to_api_paths() {
        assert_eq!(validated_url("/api/v1/whoami").unwrap(), "https://visionxixlabs.com/api/v1/whoami");
        assert!(validated_url("https://attacker.example/api/v1/whoami").is_err());
        assert!(validated_url("/marketing").is_err());
        assert!(validated_url("/api/test\nInjected: true").is_err());
    }

    #[test]
    fn permits_put_for_desktop_policy_and_revision_updates() {
        assert!(allowed_method(&reqwest::Method::PUT));
        assert!(!allowed_method(&reqwest::Method::PATCH));
    }
    #[test]
    fn stream_scope_is_narrow_and_canonical() {
        assert!(stream_path("/api/desktop/agent/conversations/conv_123/messages"));
        for path in ["/api/desktop/agent/conversations/../messages", "/api/desktop/agent/conversations/a/messages?x=1", "/api/v1/events/stream", "/api/desktop/agent/conversations/a/b/messages"] { assert!(!stream_path(path)); }
        assert!(valid_stream_id("12345678-1234-1234-1234-123456789012"));
        assert!(!valid_stream_id("../not-a-stream"));
    }
    #[test]
    fn stream_requires_explicit_bearer_post_and_accept() {
        let mut request = DesktopHttpRequest { method: "POST".to_string(), path: "/api/desktop/agent/conversations/a/messages".to_string(), headers: HashMap::from([("authorization".to_string(), "Bearer synthetic".to_string()), ("accept".to_string(), "application/x-ndjson".to_string())]), body: Some("{}".to_string()) };
        assert!(validate_stream_request(&request).is_ok());
        request.headers.remove("authorization");
        assert!(validate_stream_request(&request).is_err());
    }

}
