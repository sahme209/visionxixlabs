use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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

#[cfg(test)]
mod tests {
    use super::{allowed_method, validated_url};

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
}
