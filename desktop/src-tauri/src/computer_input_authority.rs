//! Native-only paired owner attestation. No caller URL, bearer, org or allow flag.
use serde_json::{json,Value};
use std::time::Duration;
const ORIGIN:&str="https://visionxixlabs.com";
fn task(s:&str)->bool{s.len()==68&&s.starts_with("bot_")&&s[4..].bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b))}
fn token(s:&str)->bool{s.len()<=4096&&s.starts_with("axm.desk.")&&s.split('.').count()==4&&s.split('.').skip(2).all(|v|!v.is_empty()&&v.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_'))}
#[cfg(test)]fn valid_binding(v:&Value,nonce:&str,task_id:&str,version:u32,meta:&Value)->bool{valid_action_binding(v,nonce,task_id,version,meta,"textedit_set_text")}
fn valid_action_binding(v:&Value,nonce:&str,task_id:&str,version:u32,meta:&Value,action:&str)->bool{
 let Some(o)=v.as_object()else{return false};let keys=["kind","organizationId","userId","sessionId","taskId","taskVersion","action","nonce","expiresAt"];
 o.len()==keys.len()&&keys.iter().all(|k|o.contains_key(*k))&&v["kind"]=="bot_computer_owner_v1"&&v["action"]==action&&v["nonce"]==nonce&&v["taskId"]==task_id&&v["taskVersion"]==version&&v["sessionId"]==meta["id"]&&["organizationId","userId","sessionId"].iter().all(|k|v[*k].as_str().map(|s|!s.is_empty()&&s.len()<=240&&s.trim()==s&&!s.chars().any(char::is_control)).unwrap_or(false))&&["organizationId","userId"].iter().all(|k|meta.get(*k).map(|m|m==&v[*k]).unwrap_or(true))
}
#[cfg(test)]fn valid_time(v:&Value,now:i64)->bool{v["expiresAt"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()).map(|d|d.timestamp_millis()>now&&d.timestamp_millis()<=now+15000).unwrap_or(false)}
#[cfg(test)]fn valid(v:&Value,nonce:&str,task_id:&str,version:u32,meta:&Value,now:i64)->bool{valid_binding(v,nonce,task_id,version,meta)&&valid_time(v,now)}

#[cfg(target_os="macos")]extern "C"{fn axiom_input_monotonic_now()->f64;}
fn monotonic_now()->Result<f64,String>{#[cfg(target_os="macos")]{let value=unsafe{axiom_input_monotonic_now()};if value.is_finite(){Ok(value)}else{Err("owner_proof_time_invalid".into())}}#[cfg(not(target_os="macos"))]{Err("native_input_unsupported".into())}}
fn clock_bound(expiry:&str,http_date:&str,start:f64,now:f64,wall:i64)->Option<(String,f64)>{
 if !start.is_finite()||!now.is_finite()||now<start||now>=start+15.0{return None}
 let date=chrono::DateTime::parse_from_rfc2822(http_date).ok()?.with_timezone(&chrono::Utc);
 if date.format("%a, %d %b %Y %H:%M:%S GMT").to_string()!=http_date{return None}
 let original=chrono::DateTime::parse_from_rfc3339(expiry).ok()?.timestamp_millis();let lifetime=original.checked_sub(date.timestamp_millis())?;
 if lifetime<=0||lifetime>16000{return None}
 let deadline=start+15.0;let remaining=((deadline-now)*1000.0).floor() as i64;let clamped=original.min(wall.checked_add(remaining)?);if clamped<=wall{return None}
 Some((chrono::DateTime::from_timestamp_millis(clamped)?.to_rfc3339_opts(chrono::SecondsFormat::Millis,true),deadline))
}
fn js_truthy(v:&Value)->bool{match v{Value::Null=>false,Value::Bool(b)=>*b,Value::Number(n)=>n.as_f64().map(|n|n!=0.0).unwrap_or(true),Value::String(s)=>!s.is_empty(),_=>true}}
// Match the desktop's atomic active selection. Never fall back across identities.
fn session_meta(v:&Value)->bool{["id","deviceLabel"].iter().all(|k|v[*k].as_str().map(|s|!s.trim().is_empty()).unwrap_or(false))&&v["expiresAt"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()).is_some()}
fn selected(selection:Option<Value>,legacy_api:Option<Value>,legacy_token:Option<String>,legacy_meta:Option<Value>)->Result<(String,Value,Value),String>{
 if let Some(raw)=selection.filter(|v|!v.is_null()) {
  if raw["version"]!=1||raw["active"]!="paired_session"{return Err("native_input_owner_authority_unavailable".into())}
  let paired=&raw["pairedSession"];let bearer=paired["token"].as_str().filter(|s|token(s)).ok_or("native_input_owner_authority_unavailable")?;
  let meta=paired["session"].clone();if !session_meta(&meta){return Err("native_input_owner_authority_unavailable".into())}
  return Ok((bearer.to_owned(),meta,json!({"selection":raw})))
 }
 // The desktop legacy loader prefers any existing API key. Native input may
 // not silently substitute a legacy paired user for that selected identity.
 if legacy_api.as_ref().map(js_truthy).unwrap_or(false){return Err("native_input_owner_authority_unavailable".into())}
 let bearer=legacy_token.filter(|s|token(s)).ok_or("native_input_owner_authority_unavailable")?;
 let meta=legacy_meta.filter(session_meta).ok_or("native_input_owner_authority_unavailable")?;
 Ok((bearer.clone(),meta.clone(),json!({"legacyToken":bearer,"session":meta})))
}
fn read_selected(app:&tauri::AppHandle)->Result<(String,Value,Value),String>{
 let selection=crate::secure::read_value(app,"desktop.credential.selection.v1")?.filter(|v|!v.is_null());
 if selection.is_some(){return selected(selection,None,None,None)}
 let key=crate::secure::read_value(app,"desktop.api_key")?;
 if key.as_ref().map(js_truthy).unwrap_or(false){return selected(None,key,None,None)}
 selected(None,key,crate::secure::read_string(app,"desktop.session.token")?,crate::secure::read_value(app,"desktop.session.meta")?)
}
fn secure_nonce()->Result<String,String>{
 #[cfg(target_os="macos")]{let mut random=[0u8;32];unsafe{libc::arc4random_buf(random.as_mut_ptr().cast(),random.len());}Ok(random.iter().map(|b|format!("{b:02x}")).collect())}
 #[cfg(not(target_os="macos"))]{Err("native_input_unsupported".into())}
}
#[cfg(all(test,not(target_os="macos")))]#[test]fn unsupported_nonce_is_fail_closed(){assert_eq!(secure_nonce(),Err("native_input_unsupported".into()));}
pub async fn attest(app:&tauri::AppHandle,task_id:&str,version:u32)->Result<Value,String>{attest_action(app,task_id,version,"textedit_set_text").await}
pub async fn attest_recovery(app:&tauri::AppHandle,task_id:&str,version:u32)->Result<Value,String>{attest_action(app,task_id,version,"textedit_read_outcome").await}
async fn attest_action(app:&tauri::AppHandle,task_id:&str,version:u32,action:&str)->Result<Value,String>{
 if !task(task_id)||version>2147483647{return Err("owner_credential_unavailable".into())}
 let (bearer,meta,snapshot)=read_selected(app).map_err(|_|"owner_credential_unavailable")?;
 if meta["expiresAt"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()).map(|d|d.timestamp_millis()>chrono::Utc::now().timestamp_millis())!=Some(true){return Err("owner_credential_unavailable".into())}
 let nonce=secure_nonce()?;
 let request_start=monotonic_now()?;
 let client=reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(3)).timeout(Duration::from_secs(5)).build().map_err(|_|"owner_service_unavailable")?;
 let (result,server_date)=tokio::time::timeout(Duration::from_secs(5),async{let mut r=client.post(format!("{ORIGIN}/api/desktop/bot/tasks/{task_id}/computer-authority")).bearer_auth(&bearer).json(&json!({"nonce":nonce,"taskVersion":version,"action":action})).send().await.map_err(|_|"owner_service_unavailable")?;if r.status()!=reqwest::StatusCode::OK{return Err("owner_service_refused")}
 if r.content_length().map(|n|n>8192).unwrap_or(false){return Err("owner_service_unavailable")}let date_headers:Vec<_>=r.headers().get_all(reqwest::header::DATE).iter().collect();if date_headers.len()!=1{return Err("owner_proof_time_invalid")}let server_date=date_headers[0].to_str().map_err(|_|"owner_proof_time_invalid")?.to_owned();let mut bytes=Vec::new();while let Some(chunk)=r.chunk().await.map_err(|_|"owner_service_unavailable")?{if bytes.len()+chunk.len()>8192{return Err("owner_service_unavailable")}bytes.extend_from_slice(&chunk)}Ok((serde_json::from_slice::<Value>(&bytes).map_err(|_|"owner_proof_binding_invalid")?,server_date))}).await.map_err(|_|"owner_service_unavailable")??;
 if !super::exact(&result,&["ok","data"])||result["ok"]!=true||!valid_action_binding(&result["data"],&nonce,task_id,version,&meta,action){return Err("owner_proof_binding_invalid".into())}
 if read_selected(app).map_err(|_|"owner_credential_unavailable")?.2!=snapshot{return Err("owner_credential_unavailable".into())}
 let (expiry,deadline)=clock_bound(result["data"]["expiresAt"].as_str().ok_or("owner_proof_time_invalid")?,&server_date,request_start,monotonic_now()?,chrono::Utc::now().timestamp_millis()).ok_or("owner_proof_time_invalid")?;
 let mut internal=result["data"].clone();internal["expiresAt"]=json!(expiry);internal["_nativeDeadline"]=json!(deadline);Ok(internal)
}
#[cfg(test)]mod tests{use super::*;#[test]fn exact_challenge_owner_and_short_lifetime(){let now=chrono::Utc::now().timestamp_millis();let meta=json!({"id":"paired"});let task="bot_".to_owned()+&"a".repeat(64);let mut v=json!({"kind":"bot_computer_owner_v1","organizationId":"org","userId":"user","sessionId":"paired","taskId":task,"taskVersion":0,"action":"textedit_set_text","nonce":"a".repeat(64),"expiresAt":chrono::DateTime::from_timestamp_millis(now+14000).unwrap().to_rfc3339()});assert!(valid(&v,&"a".repeat(64),&task,0,&meta,now));for key in ["nonce","sessionId","taskId","action"]{let old=v[key].clone();v[key]=json!("forged");assert!(!valid(&v,&"a".repeat(64),&task,0,&meta,now));v[key]=old;}v["expiresAt"]=json!(chrono::DateTime::from_timestamp_millis(now+16000).unwrap().to_rfc3339());assert!(!valid(&v,&"a".repeat(64),&task,0,&meta,now));}#[test]fn token_and_task_never_accept_url_or_api_key(){assert!(!task("../../other"));assert!(!token("api-key"));assert!(token("axm.desk.id.secret"));}}

#[cfg(test)]mod selection_tests{use super::*;
 fn meta()->Value{json!({"id":"paired","deviceLabel":"Mac","expiresAt":"2030-01-01T00:00:00.000Z"})}
 fn selection(active:&str)->Value{json!({"version":1,"active":active,"apiKey":"inactive-key","pairedSession":{"token":"axm.desk.selected.secret","session":meta()}})}
 #[test]fn selected_pair_wins_over_stale_legacy_and_snapshot_covers_whole_selection(){let raw=selection("paired_session");let (bearer,m,s)=selected(Some(raw.clone()),Some(json!("legacy-key")),Some("axm.desk.old.secret".into()),Some(json!({"id":"old"}))).unwrap();assert_eq!(bearer,"axm.desk.selected.secret");assert_eq!(m,meta());assert_eq!(s,json!({"selection":raw}));let mut changed=selection("paired_session");changed["pairedSession"]["session"]["id"]=json!("other");assert_ne!(selected(Some(changed),None,None,None).unwrap().2,s);}
 #[test]fn signed_out_api_key_and_malformed_explicit_selection_never_fall_back(){for raw in [selection("signed_out"),selection("api_key"),json!({"version":2,"active":"paired_session"}),json!({"version":1,"active":"paired_session","pairedSession":{}}),json!("corrupt")]{assert!(selected(Some(raw),None,Some("axm.desk.legacy.secret".into()),Some(meta())).is_err())}}
 #[test]fn legacy_pair_only_when_selection_absent_and_no_truthy_api_key(){let b=Some("axm.desk.legacy.secret".to_owned());assert!(selected(None,None,b.clone(),Some(meta())).is_ok());assert!(selected(Some(Value::Null),None,b.clone(),Some(meta())).is_ok());for key in [json!("invalid-but-selected-key"),json!(" "),json!({}),json!(42),json!(true)]{assert!(selected(None,Some(key),b.clone(),Some(meta())).is_err())}for key in [Value::Null,json!(""),json!(0),json!(false)]{assert!(selected(None,Some(key),b.clone(),Some(meta())).is_ok())}}
 #[test]fn malformed_paired_metadata_never_uses_legacy(){for field in ["id","deviceLabel","expiresAt"]{let mut raw=selection("paired_session");raw["pairedSession"]["session"][field]=json!("");assert!(selected(Some(raw),None,Some("axm.desk.legacy.secret".into()),Some(meta())).is_err())}}
 #[test]fn changed_active_selection_changes_snapshot_even_when_pair_remains_stored(){let old=selected(Some(selection("paired_session")),None,None,None).unwrap().2;assert!(selected(Some(selection("signed_out")),None,None,None).is_err());let mut current=selection("paired_session");current["pairedSession"]["token"]=json!("axm.desk.new.secret");assert_ne!(old,selected(Some(current),None,None,None).unwrap().2);}
}

#[cfg(test)]mod proof_stage_tests{use super::*;#[test]fn time_guard_is_independent_of_binding_and_unchanged(){let now=chrono::Utc::now().timestamp_millis();for delta in [0,15001,-1]{let v=json!({"expiresAt":chrono::DateTime::from_timestamp_millis(now+delta).unwrap().to_rfc3339()});assert!(!valid_time(&v,now))}for delta in [1,15000]{let v=json!({"expiresAt":chrono::DateTime::from_timestamp_millis(now+delta).unwrap().to_rfc3339()});assert!(valid_time(&v,now))}assert!(!valid_time(&json!({"expiresAt":"invalid"}),now));}}

#[cfg(test)]mod bounded_clock_tests{use super::*;const DATE:&str="Mon, 26 Oct 2026 18:00:00 GMT";fn wall()->i64{chrono::DateTime::parse_from_rfc2822(DATE).unwrap().timestamp_millis()}fn expiry(ms:i64)->String{chrono::DateTime::from_timestamp_millis(wall()+ms).unwrap().to_rfc3339_opts(chrono::SecondsFormat::Millis,true)}
 #[test]fn trusted_date_bounds_original_proof_without_extending_request_budget(){let (clamped,deadline)=clock_bound(&expiry(15500),DATE,100.0,102.0,wall()+2000).unwrap();assert_eq!(deadline,115.0);assert_eq!(clamped,expiry(15000));let (_,late_deadline)=clock_bound(&expiry(15500),DATE,100.0,114.9,wall()+14900).unwrap();assert_eq!(late_deadline,115.0);assert!(clock_bound(&expiry(15500),DATE,100.0,115.0,wall()).is_none());}
 #[test]fn malformed_missing_and_unbounded_server_time_fail_closed(){for date in ["", "bad", "Mon, 26 Oct 2026 18:00:00 GMT, Mon, 26 Oct 2026 18:00:00 GMT"]{assert!(clock_bound(&expiry(15000),date,100.0,101.0,wall()).is_none())}for ms in [-1,0,16001]{assert!(clock_bound(&expiry(ms),DATE,100.0,101.0,wall()).is_none())}assert!(clock_bound(&expiry(16000),DATE,100.0,101.0,wall()).is_some());}
 #[test]fn client_clock_never_makes_proof_live_beyond_original_or_fifteen_seconds(){let (s,d)=clock_bound(&expiry(15000),DATE,100.0,103.0,wall()-60000).unwrap();assert_eq!(d,115.0);assert_eq!(s,expiry(-48000));assert!(clock_bound(&expiry(15000),DATE,100.0,103.0,wall()+16000).is_none());assert!(clock_bound(&expiry(15000),DATE,f64::NAN,103.0,wall()).is_none());assert!(clock_bound(&expiry(15000),DATE,104.0,103.0,wall()).is_none());}
}

#[cfg(test)]#[test]fn recovery_attestation_cannot_be_replayed_as_input(){let task="bot_".to_owned()+&"a".repeat(64);let nonce="b".repeat(64);let meta=json!({"id":"paired"});let mut proof=json!({"kind":"bot_computer_owner_v1","organizationId":"org","userId":"user","sessionId":"paired","taskId":task,"taskVersion":0,"action":"textedit_read_outcome","nonce":nonce,"expiresAt":"2030-01-01T00:00:00Z"});assert!(!valid_binding(&proof,&nonce,&task,0,&meta));assert!(valid_action_binding(&proof,&nonce,&task,0,&meta,"textedit_read_outcome"));proof["action"]=json!("textedit_set_text");assert!(!valid_action_binding(&proof,&nonce,&task,0,&meta,"textedit_read_outcome"));}
