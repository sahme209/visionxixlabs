//! Single-window native observation. No input, streaming, disk, upload or model API.
use serde::Deserialize;
use serde_json::{json,Value};
const MAX_RESPONSE:usize=6*1024*1024;
const MAX_PNG:usize=4*1024*1024;
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct SelectInput {owner_context_ref:String,confirm_select:bool}
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct CaptureInput {owner_context_ref:String,session_id:String,expected_revision:u32,confirm_capture:bool}
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct CurrentInput {owner_context_ref:String,session_id:String,expected_revision:u32}
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct StopInput {owner_context_ref:String,session_id:Option<String>}
fn owner(value:&str)->bool {!value.is_empty()&&value.len()<=240&&value.trim()==value&&!value.chars().any(|c|c.is_control())}
fn session(value:&str)->bool {let Some(uuid)=value.strip_prefix("observation_") else{return false};uuid.len()==36&&uuid.bytes().enumerate().all(|(i,b)|if [8,13,18,23].contains(&i){b==b'-'}else{b.is_ascii_digit()||(b'a'..=b'f').contains(&b)})}
fn exact(v:&Value,keys:&[&str])->bool {v.as_object().map(|o|o.len()==keys.len()&&keys.iter().all(|k|o.contains_key(*k))).unwrap_or(false)}
fn flags(v:&Value)->bool {v["source"]=="native_selected_window"&&v["inputAvailable"]==false&&v["aiSharingAvailable"]==false&&v["backgroundCapture"]==false}
fn canonical_time(v:&Value)->bool {v.as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok().map(|d|d.to_rfc3339_opts(chrono::SecondsFormat::Millis,true)==s)).unwrap_or(false)}
fn checked(operation:i32,v:Value,input:&Value)->Result<Value,String>{
 let valid=match operation {
 0=>flags(&v)&&((exact(&v,&["supported","source","inputAvailable","aiSharingAvailable","backgroundCapture"])&&v["supported"]==true)||(exact(&v,&["supported","reason","source","inputAvailable","aiSharingAvailable","backgroundCapture"])&&v["supported"]==false&&["os_unsupported","runtime_unavailable"].iter().any(|r|v["reason"]==*r))),
 1=>exact(&v,&["source","inputAvailable","aiSharingAvailable","backgroundCapture","sessionId","revision","appLabel","windowLabel","expiresAt"])&&flags(&v)&&v["sessionId"].as_str().map(session).unwrap_or(false)&&v["revision"]==0&&v["appLabel"].as_str().map(owner).unwrap_or(false)&&v["windowLabel"].as_str().map(owner).unwrap_or(false)&&canonical_time(&v["expiresAt"]),
 2=>{let image=v["pngBase64"].as_str();let png_ok=image.map(|s|{if s.is_empty()||s.len()>5_592_408||s.len()%4!=0{return false}let padding=s.bytes().rev().take_while(|b|*b==b'=').count();padding<=2&&s[..s.len()-padding].bytes().all(|b|b.is_ascii_alphanumeric()||b==b'+'||b==b'/')&&(s.len()/4*3-padding)<=MAX_PNG}).unwrap_or(false);let width=v["width"].as_u64().unwrap_or(0);let height=v["height"].as_u64().unwrap_or(0);exact(&v,&["source","inputAvailable","aiSharingAvailable","backgroundCapture","sessionId","revision","observedAt","width","height","pngBase64","expiresAt"])&&flags(&v)&&v["sessionId"]==input["sessionId"]&&v["revision"].as_u64()==input["expectedRevision"].as_u64().and_then(|n|n.checked_add(1))&&width>0&&height>0&&width<=1600&&height<=1600&&width*height<=4_000_000&&png_ok&&canonical_time(&v["observedAt"])&&canonical_time(&v["expiresAt"])},
 3=>exact(&v,&["stopped"])&&v["stopped"]==true,
 5=>exact(&v,&["current"])&&v["current"].is_boolean(),
 _=>false};if valid{Ok(v)}else{Err("native_observation_capture_invalid".into())}
}
#[cfg(target_os="macos")]
mod native {
 use super::*;
 use std::{collections::HashMap,ffi::{CStr,CString,c_char},sync::{Mutex,OnceLock,atomic::{AtomicU64,Ordering}}};
 use tokio::sync::oneshot;
 type ResultSender=oneshot::Sender<Result<Value,String>>;
 static REQUESTS:OnceLock<Mutex<HashMap<u64,ResultSender>>>=OnceLock::new();
 static NEXT:AtomicU64=AtomicU64::new(1);
 extern "C" {fn axiom_observation_request(operation:i32,id:u64,input:*const c_char,callback:extern "C" fn(u64,*const c_char));}
 fn requests()->&'static Mutex<HashMap<u64,ResultSender>>{REQUESTS.get_or_init(||Mutex::new(HashMap::new()))}
 extern "C" fn reply(id:u64,raw:*const c_char){
  let sender=requests().lock().ok().and_then(|mut map|map.remove(&id));let Some(sender)=sender else{return};
  let result=if raw.is_null(){Err("native_observation_capture_unavailable".into())}else{
   // Pointer and its lifetime are provided only by the linked owned Swift bridge.
   let bytes=unsafe{CStr::from_ptr(raw)}.to_bytes();
   if bytes.len()>MAX_RESPONSE{Err("native_observation_capture_invalid".into())}else{match serde_json::from_slice::<Value>(bytes){Ok(v)if exact(&v,&["ok","data"])&&v["ok"]==true=>Ok(v["data"].clone()),Ok(v)if exact(&v,&["ok","error"])&&v["ok"]==false=>{let code=v["error"].as_str().unwrap_or("");if ["native_observation_unsupported","native_observation_foreground_required","native_observation_operation_busy","native_observation_invalid_request","native_observation_selection_cancelled","native_observation_selection_unavailable","native_observation_session_changed","native_observation_session_expired","native_observation_capture_unavailable","native_observation_capture_invalid","native_observation_operation_stopped","native_observation_operation_timeout"].contains(&code){Err(code.into())}else{Err("native_observation_capture_unavailable".into())}},_=>Err("native_observation_capture_invalid".into())}}
  };let _=sender.send(result);
 }
 extern "C" fn ignored(_:u64,_:*const c_char){}
 fn dispatch(operation:i32,id:u64,input:&Value,callback:extern "C" fn(u64,*const c_char))->Result<(),String>{let text=serde_json::to_string(input).map_err(|_|"native_observation_invalid_request")?;if text.len()>2048{return Err("native_observation_invalid_request".into())}let text=CString::new(text).map_err(|_|"native_observation_invalid_request")?;unsafe{axiom_observation_request(operation,id,text.as_ptr(),callback)};Ok(())}
 struct Pending(u64);impl Drop for Pending{fn drop(&mut self){if let Ok(mut map)=requests().lock(){map.remove(&self.0);}}}
 pub async fn request(operation:i32,input:Value)->Result<Value,String>{let id=NEXT.fetch_add(1,Ordering::Relaxed);let(tx,rx)=oneshot::channel();{let mut map=requests().lock().map_err(|_|"native_observation_capture_unavailable")?;if map.len()>=16{return Err("native_observation_capture_unavailable".into())}map.insert(id,tx);}let _pending=Pending(id);dispatch(operation,id,&input,reply)?;
  match tokio::time::timeout(std::time::Duration::from_secs(if operation==1{65}else{15}),rx).await {Ok(Ok(result))=>result, _=>{if operation==1||operation==2{let cancel=json!({"ownerContextRef":input["ownerContextRef"],"sessionId":if operation==1{Value::Null}else{input["sessionId"].clone()}});let _=dispatch(3,0,&cancel,ignored);}Err("native_observation_operation_timeout".into())}}
 }
 pub fn revoke_all(){let _=dispatch(4,0,&json!({}),ignored);}
}
async fn request(operation:i32,input:Value)->Result<Value,String>{
 #[cfg(target_os="macos")]{let result=native::request(operation,input.clone()).await?;checked(operation,result,&input)}
 #[cfg(not(target_os="macos"))]{let _=input;if operation==0{Ok(json!({"supported":false,"reason":"os_unsupported","source":"native_selected_window","inputAvailable":false,"aiSharingAvailable":false,"backgroundCapture":false}))}else{Err("native_observation_unsupported".into())}}
}
fn main_window(window:&tauri::WebviewWindow)->Result<(),String>{if window.label()=="main"{Ok(())}else{Err("native_observation_invalid_request".into())}}
#[tauri::command]
pub async fn computer_observation_status(window:tauri::WebviewWindow)->Result<Value,String>{main_window(&window)?;request(0,json!({})).await}
#[tauri::command]
pub async fn computer_observation_select(window:tauri::WebviewWindow,input:SelectInput)->Result<Value,String>{main_window(&window)?;if !owner(&input.owner_context_ref)||!input.confirm_select{return Err("native_observation_invalid_request".into())}request(1,json!({"ownerContextRef":input.owner_context_ref,"confirmSelect":true})).await}
#[tauri::command]
pub async fn computer_observation_capture(window:tauri::WebviewWindow,input:CaptureInput)->Result<Value,String>{main_window(&window)?;if !owner(&input.owner_context_ref)||!session(&input.session_id)||input.expected_revision>=2147483647||!input.confirm_capture{return Err("native_observation_invalid_request".into())}request(2,json!({"ownerContextRef":input.owner_context_ref,"sessionId":input.session_id,"expectedRevision":input.expected_revision,"confirmCapture":true})).await}
#[tauri::command]
pub async fn computer_observation_current(window:tauri::WebviewWindow,input:CurrentInput)->Result<Value,String>{main_window(&window)?;if !owner(&input.owner_context_ref)||!session(&input.session_id)||input.expected_revision>=2147483647{return Err("native_observation_invalid_request".into())}request(5,json!({"ownerContextRef":input.owner_context_ref,"sessionId":input.session_id,"expectedRevision":input.expected_revision})).await}
#[tauri::command]
pub async fn computer_observation_stop(window:tauri::WebviewWindow,input:StopInput)->Result<Value,String>{main_window(&window)?;if !owner(&input.owner_context_ref)||input.session_id.as_ref().map(|s|!session(s)).unwrap_or(false){return Err("native_observation_invalid_request".into())}request(3,json!({"ownerContextRef":input.owner_context_ref,"sessionId":input.session_id})).await}
pub fn revoke_all(){#[cfg(target_os="macos")]native::revoke_all();}
#[cfg(test)]mod tests{use super::*;
 #[test]fn exact_requests_reject_extra_authority(){assert!(serde_json::from_value::<SelectInput>(json!({"ownerContextRef":"owned","confirmSelect":true,"click":true})).is_err());assert!(serde_json::from_value::<CaptureInput>(json!({"ownerContextRef":"owned","sessionId":"x","expectedRevision":0,"confirmCapture":true,"windowId":12})).is_err());assert!(serde_json::from_value::<StopInput>(json!({"ownerContextRef":"owned","sessionId":null})).is_ok());}
 #[test]fn current_check_is_strict_metadata_only(){assert!(serde_json::from_value::<CurrentInput>(json!({"ownerContextRef":"owned","sessionId":"observation_11111111-1111-4111-8111-111111111111","expectedRevision":0})).is_ok());assert!(serde_json::from_value::<CurrentInput>(json!({"ownerContextRef":"owned","sessionId":"x","expectedRevision":0,"capture":true})).is_err());assert!(checked(5,json!({"current":true}),&json!({})).is_ok());assert!(checked(5,json!({"current":false}),&json!({})).is_ok());assert!(checked(5,json!({"current":true,"pngBase64":"pixels"}),&json!({})).is_err());}
 #[test]fn identity_bounds_are_exact(){assert!(owner("opaque_context"));assert!(!owner(" bad"));assert!(!owner(&"x".repeat(241)));assert!(session("observation_11111111-1111-4111-8111-111111111111"));assert!(!session("mock_observation_11111111-1111-4111-8111-111111111111"));}
 #[test]fn status_cannot_grant_input_or_ai(){let good=json!({"supported":true,"source":"native_selected_window","inputAvailable":false,"aiSharingAvailable":false,"backgroundCapture":false});assert!(checked(0,good.clone(),&json!({})).is_ok());let mut bad=good;bad["inputAvailable"]=json!(true);assert!(checked(0,bad,&json!({})).is_err());}
 #[test]fn capture_must_match_session_revision_bounds_and_canonical_time(){let input=json!({"sessionId":"observation_11111111-1111-4111-8111-111111111111","expectedRevision":0});let good=json!({"source":"native_selected_window","inputAvailable":false,"aiSharingAvailable":false,"backgroundCapture":false,"sessionId":input["sessionId"],"revision":1,"observedAt":"2026-10-26T15:00:00.000Z","width":1,"height":1,"pngBase64":"iVBORw==","expiresAt":"2026-10-26T15:02:00.000Z"});assert!(checked(2,good.clone(),&input).is_ok());for(key,value)in [("revision",json!(2)),("sessionId",json!("other")),("width",json!(1601)),("observedAt",json!("yesterday")),("aiSharingAvailable",json!(true))]{let mut bad=good.clone();bad[key]=value;assert!(checked(2,bad,&input).is_err());}}
}
