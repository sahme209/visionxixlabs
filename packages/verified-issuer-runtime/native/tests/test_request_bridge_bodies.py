"""Compile/run only extracted changed bodies with fully synthetic API bindings.
No original native target/addon, Security/XPC/NAPI/service call is executed.
"""
import pathlib,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def body(file,start,end):
 text=(ROOT/file).read_text();return text[text.index(start):text.index(end,text.index(start))]
def run(source):
 with tempfile.TemporaryDirectory(prefix='axiom-request-mock-') as d:
  p=pathlib.Path(d);(p/'test.c').write_text(source)
  compiled=subprocess.run(['/usr/bin/clang','-std=c11','-Wall','-Wextra','-Werror','-Wno-unused-function','-Wno-unused-variable','-fblocks','-I'+str(ROOT/'tests'),str(p/'test.c'),str(ROOT/'request_protocol.c'),'-o',str(p/'test')],capture_output=True,text=True)
  if compiled.returncode:raise AssertionError(compiled.stderr)
  subprocess.run([str(p/'test')],check=True,capture_output=True)
class Bodies(unittest.TestCase):
 def test_actual_broker_arbitrates_cancelled_request_and_exact_sender(self):
  pre='''#include "request_bridge_stubs.h"
typedef struct{atomic_int ended;xpc_connection_t connection;}Peer;
static AxRequestSlot business;static struct{uintptr_t peer;int phase,child;}slot;static uint64_t epoch=3;static int workers,control,authenticated=1,dropped,business_child_auth_busy,business_lane_ready,epoch_revoked,shutting_down,owned_child=9;
#define AXIOM_ORIGIN_CONSUMED 4
#define DELIVERY_CONSUMED 3
static struct{int phase;}delivery;
static int owner_profile_current(void){return 1;}static int alive_pid(int p){return p==owned_child;}
static int message_matches(Obj*m,const char*r){(void)m;(void)r;return authenticated;}
#define AXIOM_ISSUER_NODE_REQUIREMENT "fixed"
static int business_owned(void){return 1;}static void retain_peer(Peer*p){(void)p;}static void release_peer(Peer*p){(void)p;}
static void business_external_result(const char*s,const unsigned char*b,size_t n){(void)s;(void)b;(void)n;}static void business_drop(void){dropped++;memset(&business,0,sizeof(business));}
'''
  code=body('origin_broker.c','static void business_child(Peer*','static void business_external(')
  post='''int main(void){unsigned char id[32]={1},nonce[32]={2};Obj*conn=obj(3);Peer p={.connection=conn};slot.peer=(uintptr_t)conn;assert(ax_request_admit(&business,1,(uintptr_t)conn,3,100,1,id,1));assert(ax_request_dispatch(&business,2));Obj*m=obj(1);xpc_dictionary_set_string(m,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(m,"kind","request_current");xpc_dictionary_set_data(m,"id",id,32);xpc_dictionary_set_uint64(m,"epoch",3);xpc_dictionary_set_data(m,"nonce",nonce,32);
 business_child(&p,m);assert(!strcmp(xpc_dictionary_get_string(sent,"status"),"eligible"));assert(ax_request_cancel(&business,1,id));business_child(&p,m);assert(!strcmp(xpc_dictionary_get_string(sent,"status"),"refused"));assert(!dropped);
 authenticated=0;business.phase=AX_REQUEST_DISPATCHED;business_child(&p,m);assert(!strcmp(xpc_dictionary_get_string(sent,"status"),"refused"));Obj*wrong=obj(3);p.connection=wrong;authenticated=1;business_child(&p,m);assert(!strcmp(xpc_dictionary_get_string(sent,"status"),"refused"));
 p.connection=conn;business.phase=AX_REQUEST_CANCELLED;Obj*r=obj(1);unsigned char frame[8]={0,0,1,247,0,0,0,0};xpc_dictionary_set_string(r,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(r,"kind","response");xpc_dictionary_set_data(r,"id",id,32);xpc_dictionary_set_uint64(r,"epoch",3);xpc_dictionary_set_data(r,"nonce",nonce,32);xpc_dictionary_set_data(r,"bytes",frame,8);business_child(&p,r);assert(!dropped&&business.phase==AX_REQUEST_CANCELLED);Obj*d=obj(1);xpc_dictionary_set_string(d,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(d,"kind","drained");xpc_dictionary_set_data(d,"id",id,32);xpc_dictionary_set_uint64(d,"epoch",3);xpc_dictionary_set_data(d,"nonce",nonce,32);business_child(&p,d);assert(dropped==1&&business.phase==AX_REQUEST_EMPTY);id[0]=9;assert(ax_request_admit(&business,1,(uintptr_t)conn,3,100,11,id,1));assert(ax_request_dispatch(&business,12));return 0;}'''
  run(pre+code+post)
 def test_actual_session_event_parser_rejects_foreign_epoch_and_drains_cancel(self):
  pre='''#include "request_bridge_stubs.h"
typedef int pthread_mutex_t;static void pthread_mutex_lock(int*p){(void)p;}static void pthread_mutex_unlock(int*p){(void)p;}
typedef struct{atomic_int invalid;uint64_t epoch,deadline;pthread_mutex_t request_lock;int request_wake,request_pending,request_delivered,request_cancelled,request_cancel_delivered;unsigned char request_id[32],retired_id[32],request_bytes[AX_REQUEST_INPUT_CAP];size_t request_length;uint64_t request_deadline;}AxiomOriginSession;
static int broker_ok=1;static int received_broker(Obj*m){(void)m;return broker_ok;}
'''
  code=body('origin_session.c','static int wire_u64(','int axiom_origin_session_next_request(')
  post='''int main(void){AxiomOriginSession s={.epoch=3,.deadline=100};unsigned char id[32]={1},bytes[2]={9,8};Obj*m=obj(1);xpc_dictionary_set_string(m,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(m,"kind","request");xpc_dictionary_set_data(m,"id",id,32);xpc_dictionary_set_uint64(m,"epoch",3);xpc_dictionary_set_uint64(m,"deadline",90);xpc_dictionary_set_data(m,"bytes",bytes,2);broker_ok=0;assert(!receive_request(&s,m));broker_ok=1;s.epoch=4;assert(!receive_request(&s,m));s.epoch=3;assert(receive_request(&s,m)&&s.request_pending&&s.request_length==2);assert(!receive_request(&s,m));Obj*c=obj(1);xpc_dictionary_set_string(c,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(c,"kind","cancel");xpc_dictionary_set_data(c,"id",id,32);xpc_dictionary_set_uint64(c,"epoch",3);assert(receive_request(&s,c)&&s.request_cancelled);xpc_dictionary_set_uint64(c,"unexpected",1);assert(!receive_request(&s,c));return 0;}'''
  run(pre+code+post)
 def test_actual_napi_wait_close_and_currentness_bodies_with_mocked_node(self):
  code=body('origin_guard.c','static void revoke_origin(void*value)','static void cleanup_origin(')+body('origin_guard.c','typedef struct{NativeOrigin*origin;napi_async_work work;','static napi_value initialize(napi_env env,napi_value exports){')
  post=r'''int main(void){NativeOrigin o={.bootstrap_consumed=1};atomic_init(&o.refs,1);atomic_init(&o.invalid,0);owned=&o;napi_env env=(void*)1;
 argument_count=0;assert(next_request_event(env,NULL));assert(o.request_waiting&&atomic_load(&o.refs)==2);assert(!next_request_event(env,NULL));assert(refused==1);
 assert(close_runtime(env,NULL));assert(atomic_load(&o.invalid));napi_async_work w=queued;w->execute(env,w->data);w->complete(env,0,w->data);assert(!o.request_waiting&&rejected==1&&resolved==0&&atomic_load(&o.refs)==1);
 assert(close_runtime(env,NULL));assert(closed==1);V id={.type=1};memset(id.text,'a',64);arguments[0]=&id;argument_count=1;assert(!assert_request_current(env,NULL));assert(current_calls==0);
 atomic_store(&o.invalid,0);current_ok=0;assert(!assert_request_current(env,NULL));assert(current_calls==1);current_ok=1;assert(assert_request_current(env,NULL));assert(current_calls==2);
 id.text[64]='a';id.text[65]=0;assert(!assert_request_current(env,NULL));assert(current_calls==2);id.text[64]=0;V frame={.type=2,.bytes={0,0,0,200,0,0,0,1,42},.length=9};arguments[1]=&frame;argument_count=2;assert(complete_request(env,NULL)&&complete_calls==1);frame.length=AX_REQUEST_FRAME_CAP+1;assert(!complete_request(env,NULL)&&complete_calls==1);return 0;}'''
  run('#include "request_napi_stubs.h"\n'+code+post)
 def test_actual_session_terminal_completion_can_drain_after_deadline(self):
  pre=r'''#include "request_bridge_stubs.h"
#define AXIOM_ORIGIN_EXCHANGE_NS 250000000ULL
#define DISPATCH_TIME_NOW 0
#define QOS_CLASS_USER_INITIATED 0
#define getpid() 7
static int pthread_mutex_lock(int*p){(void)p;return 0;}static int pthread_mutex_unlock(int*p){(void)p;return 0;}
static int dispatch_semaphore_create(int n){(void)n;return 1;}static void dispatch_release(int n){(void)n;}static int dispatch_semaphore_wait(int s,int64_t d){(void)s;(void)d;return 0;}static int64_t dispatch_time(int t,int64_t n){(void)t;return n;}static int dispatch_get_global_queue(int q,int x){(void)q;(void)x;return 0;}
#define arc4random_buf mock_random
static void mock_random(void*b,size_t n){memset(b,4,n);}
typedef struct{atomic_uint refs;atomic_int invalid;uint64_t epoch,deadline;int self,request_lock,request_pending,request_delivered,request_cancelled,request_cancel_delivered,request_wake;unsigned char request_id[32],retired_id[32],request_bytes[AX_REQUEST_INPUT_CAP];size_t request_length;uint64_t request_deadline;Obj*connection;}AxiomOriginSession;
static void release_session(AxiomOriginSession*s){atomic_fetch_sub(&s->refs,1);}static int received_broker(Obj*m){(void)m;return 1;}
static int receive_request(AxiomOriginSession*,Obj*);static AxiomOriginSession*delivery_session;
static void xpc_connection_send_message_with_reply(Obj*c,Obj*m,int q,void(^callback)(Obj*)){(void)c;(void)q;Obj*r=obj(1);size_t ni,nn;const void*id=xpc_dictionary_get_data(m,"id",&ni),*nonce=xpc_dictionary_get_data(m,"nonce",&nn);xpc_dictionary_set_string(r,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(r,"kind","request_result");xpc_dictionary_set_string(r,"status",!strcmp(xpc_dictionary_get_string(m,"kind"),"drained")?"drained":"completed");xpc_dictionary_set_uint64(r,"epoch",3);xpc_dictionary_set_data(r,"id",id,ni);xpc_dictionary_set_data(r,"nonce",nonce,nn);callback(r);if(!strcmp(xpc_dictionary_get_string(m,"kind"),"drained")){assert(!delivery_session->request_pending);unsigned char nextid[32]={9},data[1]={1};Obj*event=obj(1);xpc_dictionary_set_string(event,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(event,"kind","request");xpc_dictionary_set_data(event,"id",nextid,32);xpc_dictionary_set_uint64(event,"epoch",3);xpc_dictionary_set_uint64(event,"deadline",90);xpc_dictionary_set_data(event,"bytes",data,1);assert(receive_request(delivery_session,event));}}
'''
  text=(ROOT/'origin_session.c').read_text();a=text.index('static int wire_u64(');b=text.index('int axiom_origin_session_next_request(',a);code=text[a:b]+text[text.index('typedef struct{atomic_uint refs;atomic_int cancelled,ok;'):]
  post=r'''int main(void){AxiomOriginSession s={.self=7,.epoch=3,.deadline=100,.request_pending=1,.request_delivered=1,.request_deadline=5};atomic_init(&s.refs,1);delivery_session=&s;unsigned char id[32]={1},frame[8]={0,0,1,247,0,0,0,0};memcpy(s.request_id,id,32);assert(!axiom_origin_session_request_current(&s,id));assert(axiom_origin_session_complete_request(&s,id,frame,8));assert(s.request_pending&&s.request_id[0]==9&&atomic_load(&s.refs)==1);Obj*late=obj(1);xpc_dictionary_set_string(late,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(late,"kind","cancel");xpc_dictionary_set_data(late,"id",id,32);xpc_dictionary_set_uint64(late,"epoch",3);assert(receive_request(&s,late)&&s.request_id[0]==9&&!s.request_cancelled);assert(!axiom_origin_session_complete_request(&s,id,frame,8));return 0;}'''
  run(pre+code+post)
if __name__=='__main__':unittest.main()
