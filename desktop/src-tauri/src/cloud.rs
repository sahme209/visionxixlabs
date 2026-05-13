use serde::{Deserialize, Serialize};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectorStatus {
    pub provider: String,
    pub connected: bool,
    pub account_id: Option<String>,
    pub last_validated: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub provider: String,
    pub status: String,
    pub findings_count: usize,
    pub cost_savings: Option<f64>,
    pub security_issues: usize,
    pub drift_detected: usize,
    pub timestamp: String,
}

#[tauri::command]
pub async fn validate_aws_credentials(
    app: tauri::AppHandle,
    role_arn: String,
    external_id: String,
) -> Result<ConnectorStatus, String> {
    let client = reqwest::Client::new();
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let endpoint = store
        .get("api_endpoint")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "https://visionxixlabs.com".to_string());

    let resp = client
        .post(format!("{}/api/connectors/link", endpoint))
        .json(&serde_json::json!({
            "provider": "aws",
            "credentials": {
                "roleArn": role_arn,
                "externalId": external_id,
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        Ok(ConnectorStatus {
            provider: "aws".into(),
            connected: true,
            account_id: Some(role_arn.split(':').nth(4).unwrap_or("unknown").to_string()),
            last_validated: Some(chrono::Utc::now().to_rfc3339()),
            error: None,
        })
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("AWS validation failed: {}", body))
    }
}

#[tauri::command]
pub async fn validate_azure_credentials(
    app: tauri::AppHandle,
    tenant_id: String,
    client_id: String,
    client_secret: String,
) -> Result<ConnectorStatus, String> {
    let client = reqwest::Client::new();
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let endpoint = store
        .get("api_endpoint")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "https://visionxixlabs.com".to_string());

    let resp = client
        .post(format!("{}/api/connectors/link", endpoint))
        .json(&serde_json::json!({
            "provider": "azure",
            "credentials": {
                "tenantId": tenant_id,
                "clientId": client_id,
                "clientSecret": client_secret,
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        Ok(ConnectorStatus {
            provider: "azure".into(),
            connected: true,
            account_id: Some(tenant_id),
            last_validated: Some(chrono::Utc::now().to_rfc3339()),
            error: None,
        })
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Azure validation failed: {}", body))
    }
}

#[tauri::command]
pub async fn validate_gcp_credentials(
    app: tauri::AppHandle,
    project_id: String,
    service_account_key: String,
) -> Result<ConnectorStatus, String> {
    let client = reqwest::Client::new();
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let endpoint = store
        .get("api_endpoint")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "https://visionxixlabs.com".to_string());

    let resp = client
        .post(format!("{}/api/connectors/link", endpoint))
        .json(&serde_json::json!({
            "provider": "gcp",
            "credentials": {
                "projectId": project_id,
                "serviceAccountKey": service_account_key,
            }
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        Ok(ConnectorStatus {
            provider: "gcp".into(),
            connected: true,
            account_id: Some(project_id),
            last_validated: Some(chrono::Utc::now().to_rfc3339()),
            error: None,
        })
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("GCP validation failed: {}", body))
    }
}

#[tauri::command]
pub async fn get_connector_status(
    app: tauri::AppHandle,
) -> Result<Vec<ConnectorStatus>, String> {
    let client = reqwest::Client::new();
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let endpoint = store
        .get("api_endpoint")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "https://visionxixlabs.com".to_string());

    let resp = client
        .get(format!("{}/api/connectors/status", endpoint))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let connectors = data["connectors"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|c| ConnectorStatus {
                provider: c["provider"].as_str().unwrap_or("unknown").to_string(),
                connected: c["status"].as_str() == Some("active"),
                account_id: c["accountId"].as_str().map(String::from),
                last_validated: c["verifiedAt"].as_str().map(String::from),
                error: None,
            })
            .collect();
        Ok(connectors)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn run_cloud_scan(
    app: tauri::AppHandle,
    provider: String,
    scan_type: String,
) -> Result<ScanResult, String> {
    let client = reqwest::Client::new();
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let endpoint = store
        .get("api_endpoint")
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| "https://visionxixlabs.com".to_string());

    let plugin_id = match (provider.as_str(), scan_type.as_str()) {
        ("aws", "security") => "aws:iam-exposure-scan",
        ("aws", "cost") => "aws:cost-explorer-summary",
        ("aws", "infrastructure") => "aws:infra-discovery",
        ("aws", "s3") => "aws:s3-public-bucket-scan",
        _ => return Err(format!("Unsupported scan: {}:{}", provider, scan_type)),
    };

    let resp = client
        .post(format!("{}/api/execution/run", endpoint))
        .json(&serde_json::json!({
            "pluginId": plugin_id,
            "dryRun": true,
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if resp.status().is_success() {
        let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        Ok(ScanResult {
            provider,
            status: "complete".into(),
            findings_count: data["findings"].as_array().map_or(0, |f| f.len()),
            cost_savings: data["estimatedSavings"].as_f64(),
            security_issues: data["securityIssues"].as_u64().unwrap_or(0) as usize,
            drift_detected: data["driftCount"].as_u64().unwrap_or(0) as usize,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    } else {
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Scan failed: {}", body))
    }
}
