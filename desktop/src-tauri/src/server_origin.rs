//! The one V19 service origin this app talks to.
//!
//! Default: https://visionxixlabs.com. A company running its own V19 server (self-hosted or
//! air-gapped) sets `serverUrl` in the organization policy file (managed_policy.rs), which only
//! administrators can write. Users cannot change it: there is no setting for it in the app.
//! Resolved once per launch. If the policy names a server URL that is not a plain HTTPS origin, the
//! app talks to no server at all (and the frontend shows the locked screen for the invalid policy).
use crate::managed_policy::{policy_path, read_policy_file, ManagedPolicyFile};
use std::sync::OnceLock;

pub const DEFAULT_ORIGIN: &str = "https://visionxixlabs.com";
static RESOLVED: OnceLock<Option<String>> = OnceLock::new();

/// A plain HTTPS origin (scheme, host, optional port). No path, query, fragment or credentials.
pub fn normalize_origin(input: &str) -> Option<String> {
    let trimmed = input.trim();
    if trimmed.len() > 255 {
        return None;
    }
    let url = reqwest::Url::parse(trimmed.trim_end_matches('/')).ok()?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return None;
    }
    if !(url.path().is_empty() || url.path() == "/") {
        return None;
    }
    let host = url.host_str()?;
    if host.is_empty() {
        return None;
    }
    Some(match url.port() {
        Some(port) => format!("https://{host}:{port}"),
        None => format!("https://{host}"),
    })
}

/// Some(origin) when usable; None when the policy names an invalid server URL.
pub fn resolve(file: &ManagedPolicyFile) -> Option<String> {
    let ManagedPolicyFile::Found { contents, .. } = file else {
        return Some(DEFAULT_ORIGIN.to_string());
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(contents) else {
        return Some(DEFAULT_ORIGIN.to_string()); // the frontend locks on an unparseable policy
    };
    match value.get("serverUrl") {
        None => Some(DEFAULT_ORIGIN.to_string()),
        Some(serde_json::Value::String(s)) => normalize_origin(s),
        Some(_) => None,
    }
}

/// The origin for this launch, or an error if the organization policy names an unusable server.
pub fn api_origin() -> Result<&'static str, String> {
    RESOLVED
        .get_or_init(|| resolve(&read_policy_file(&policy_path())))
        .as_deref()
        .ok_or_else(|| "Your organization's V19 server address is not valid. Contact your IT team.".to_string())
}

/// Credentials are kept per server: a non-default origin gets its own vault entries, so a session
/// issued by one server is never sent to another.
pub fn credential_key(key: &str) -> Result<String, String> {
    let origin = api_origin()?;
    Ok(if origin == DEFAULT_ORIGIN { key.to_string() } else { format!("{key}@{}", origin.trim_start_matches("https://")) })
}

#[tauri::command]
pub fn get_server_origin() -> Result<String, String> {
    api_origin().map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(contents: &str) -> ManagedPolicyFile {
        ManagedPolicyFile::Found { path: "/etc/v19/policy.json".into(), contents: contents.into() }
    }

    #[test]
    fn default_without_policy_or_server_url() {
        assert_eq!(resolve(&ManagedPolicyFile::None).as_deref(), Some(DEFAULT_ORIGIN));
        assert_eq!(resolve(&found(r#"{"managedBy":"IT"}"#)).as_deref(), Some(DEFAULT_ORIGIN));
    }

    #[test]
    fn managed_server_url_is_used_as_a_plain_https_origin() {
        assert_eq!(resolve(&found(r#"{"serverUrl":"https://v19.corp.example"}"#)).as_deref(), Some("https://v19.corp.example"));
        assert_eq!(resolve(&found(r#"{"serverUrl":"https://v19.corp.example:8443/"}"#)).as_deref(), Some("https://v19.corp.example:8443"));
    }

    #[test]
    fn unusable_server_urls_mean_no_server() {
        for bad in [r#""http://v19.corp.example""#, r#""https://v19.corp.example/app""#, r#""https://user:pw@v19.corp.example""#, r#""https://v19.corp.example?x=1""#, r#""not a url""#, "5", "null"] {
            assert_eq!(resolve(&found(&format!(r#"{{"serverUrl":{bad}}}"#))), None, "{bad}");
        }
    }
}
