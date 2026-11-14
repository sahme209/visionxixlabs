//! DORMANT Linux source integration. No native compile, linkage or supplier qualified.
#![cfg(all(target_os = "linux", target_pointer_width = "64"))]
use crate::shm::{ClockErrorBound, ClockStatus, ShmWrite};
use crate::daemon::time::clocks::PreciseOrigin;
use std::ffi::{CString, c_char, c_int};
use std::os::fd::{AsRawFd, OwnedFd};
use std::panic::{catch_unwind, AssertUnwindSafe};
#[repr(C)]
struct AxiomTimeContext { directory_fd:c_int, source_fd:c_int, publisher_uid:u32, reader_gid:u32, directory_device:u64, directory_inode:u64 }
unsafe extern "C" { fn axiom_time_publish_or_die(context:*const AxiomTimeContext,generation:*const c_char,publication:u64,bytes:*const u8,length:usize); }
fn fatal()->! { std::process::abort() }
fn generation_ok(s:&str)->bool { !s.is_empty() && s.len()<=128 && s.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'||b==b'-') }
/// No production mint exists. Only a future independently accepted protected
/// native profile may supply this value; a private type is NOT that supplier.
struct AcceptedPreciseTimePolicy { max_age_ns:u64 }
pub struct NativeTimePublisherContext {
 directory:OwnedFd,generation:String,publisher_uid:u32,reader_gid:u32,directory_device:u64,directory_inode:u64,
 accepted_policy:Option<AcceptedPreciseTimePolicy>,
}
impl NativeTimePublisherContext {
 pub fn from_protected_resource(directory:OwnedFd,generation:String,publisher_uid:u32,reader_gid:u32,directory_device:u64,directory_inode:u64)->Self {
  if !generation_ok(&generation){fatal()}
  Self{directory,generation,publisher_uid,reader_gid,directory_device,directory_inode,accepted_policy:None}
 }
 pub fn wrap_v2(self,delegate:Box<dyn ShmWrite+Send+Sync>,oscillator_dispersion:f64)->NativeTimePublisher {
  let context=AxiomTimeContext{directory_fd:self.directory.as_raw_fd(),source_fd:-1,publisher_uid:self.publisher_uid,reader_gid:self.reader_gid,directory_device:self.directory_device,directory_inode:self.directory_inode};
  NativeTimePublisher{_directory:self.directory,context,generation:CString::new(self.generation).unwrap_or_else(|_|fatal()),counter:0,initialized_unknown:false,delegate,oscillator_dispersion,accepted_policy:self.accepted_policy}
 }
}
/// Exact rational of finite nonnegative represented IEEE input. Unrepresentable
/// intermediates refuse instead of rounding/saturating or adding guessed epsilons.
fn rational(v:f64)->Option<(u128,u128)> {
 if !v.is_finite()||v<0.0{return None} if v==0.0{return Some((0,1))}
 let bits=v.to_bits();let exp=((bits>>52)&0x7ff)as i32;
 let mut mant=(bits&((1u64<<52)-1))as u128;
 let mut power=if exp==0{-1074}else{mant|=1u128<<52;exp-1023-52};
 while power<0 && mant&1==0 {mant>>=1;power+=1;}
 if power>=0 {Some((mant.checked_mul(1u128.checked_shl(power as u32)?)?,1))}
 else {Some((mant,1u128.checked_shl((-power)as u32)?))}
}
fn ceil_ratio(n:u128,d:u128)->Option<u128>{if d==0{return None}Some(n/d+u128::from(n%d!=0))}
fn gcd(mut a:u128,mut b:u128)->u128{while b!=0{let r=a%b;a=b;b=r;}a}
fn reduce(n:u128,d:u128)->Option<(u128,u128)>{if d==0{return None}let g=gcd(n,d);Some((n/g,d/g))}
fn multiply(a:(u128,u128),b:(u128,u128))->Option<(u128,u128)>{
 let g=gcd(a.0,b.1);let h=gcd(b.0,a.1);
 reduce((a.0/g).checked_mul(b.0/h)?,(a.1/h).checked_mul(b.1/g)?)
}
fn add(a:(u128,u128),b:(u128,u128))->Option<(u128,u128)>{
 let g=gcd(a.1,b.1);let left=b.1/g;let right=a.1/g;
 reduce(a.0.checked_mul(left)?.checked_add(b.0.checked_mul(right)?)?,a.1.checked_mul(left)?)
}
fn drift_ceil(period:f64,error:f64,dispersion:f64)->Option<u32>{
 if period<=0.0{return None}
 let p=rational(period)?;let e=rational(error)?;let o=rational(dispersion)?;
 let ratio=multiply(e,(p.1,p.0))?;
 let total=multiply(add(ratio,o)?,(1_000_000_000,1))?;
 let value=ceil_ratio(total.0,total.1)?;
 if value>=1_000_000_000{return None}u32::try_from(value).ok()
}

pub struct NativeTimePublisher {
 _directory:OwnedFd,context:AxiomTimeContext,generation:CString,counter:u64,initialized_unknown:bool,
 delegate:Box<dyn ShmWrite+Send+Sync>,oscillator_dispersion:f64,accepted_policy:Option<AcceptedPreciseTimePolicy>,
}
impl NativeTimePublisher {
 fn emit(&mut self,anchor:u64,expiry:u64,bound:u64,drift:u32,status:ClockStatus,value:&ClockErrorBound){
  if !matches!(value,ClockErrorBound::V2(_))||expiry<=anchor||expiry>i64::MAX as u64||bound>i64::MAX as u64||drift>=1_000_000_000{fatal()}
  if !self.initialized_unknown&&status!=ClockStatus::Unknown{fatal()}
  self.counter=self.counter.checked_add(1).unwrap_or_else(||fatal());
  let status=match status {ClockStatus::Unknown=>"unknown",ClockStatus::Synchronized=>"synchronized",ClockStatus::FreeRunning=>"free-running",ClockStatus::Disrupted=>"disrupted"};
  let generation=self.generation.to_str().unwrap_or_else(|_|fatal());
  let flag=if value.clock_disruption_support_enabled(){"1"}else{"0"};
  let record=format!("AXIOM_TIME_V2\nclockbound-precise-origin-v1\n{generation}\n{}\n{anchor}\n{expiry}\n{bound}\n{drift}\n{status}\n{}\n{flag}\nEND\n",self.counter,value.disruption_marker()).into_bytes();
  if record.len()>4096{fatal()}
  unsafe{axiom_time_publish_or_die(&self.context,self.generation.as_ptr(),self.counter,record.as_ptr(),record.len());}
  if catch_unwind(AssertUnwindSafe(||self.delegate.write(value))).is_err(){fatal()}
  self.initialized_unknown=true;
 }
 pub fn invalidate_then_delegate(&mut self,value:&ClockErrorBound){
  let status=if self.initialized_unknown&&value.clock_status()==ClockStatus::Disrupted{ClockStatus::Disrupted}else{ClockStatus::Unknown};
  self.emit(0,1,0,0,status,value);
 }
 pub fn publish_precise_then_delegate(&mut self,origin:Option<&PreciseOrigin>,period:f64,error:f64,_compatibility_drift_ppb:u32,value:&ClockErrorBound,rtt_ns:i64){
  // Accepted policy has no production issuer: actual missing evidence leaves
  // Unknown while preserving the original compatibility publication/delegate.
  let prepared=(||{
   let origin=origin?;let policy=self.accepted_policy.as_ref()?;
   if origin.counter_pre<0||origin.counter_post<=origin.counter_pre||policy.max_age_ns==0{return None}
   let expiry=origin.lower_ns.checked_add(policy.max_age_ns)?;
   let extra_bound_ns=u64::try_from(rtt_ns).ok()? % 2;
   let bound=u64::try_from(value.bound_nsec()).ok()?.checked_add(extra_bound_ns)?;
   let drift=drift_ceil(period,error,self.oscillator_dispersion)?;
   if expiry>i64::MAX as u64||bound>i64::MAX as u64{return None}
   Some((origin.lower_ns,expiry,bound,drift))
  })();
  match prepared {
   Some((anchor,expiry,bound,drift)) if value.clock_status()==ClockStatus::Synchronized=>self.emit(anchor,expiry,bound,drift,ClockStatus::Synchronized,value),
   _=>self.invalidate_then_delegate(value),
  }
 }
}
