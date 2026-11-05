#define _DARWIN_C_SOURCE 1
#include "origin_config.h"
#include "origin_session.h"
#include <xpc/xpc.h>
#include <Security/Security.h>
#include <dispatch/dispatch.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdatomic.h>
#include <time.h>
#include <pthread.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
struct AxiomOriginSession {atomic_uint refs;atomic_int invalid;atomic_flag busy;xpc_connection_t connection;pid_t self;uint64_t epoch,deadline;unsigned char client[32],broker[32];pthread_mutex_t request_lock;dispatch_semaphore_t request_wake;int request_pending,request_delivered,request_cancelled,request_cancel_delivered,request_ready_sent;unsigned char request_id[32],retired_id[32],request_bytes[AX_REQUEST_INPUT_CAP];size_t request_length;uint64_t request_deadline;};
typedef struct {atomic_uint refs;atomic_int cancelled;atomic_int success;AxiomOriginSession*session;dispatch_semaphore_t done;unsigned char client[32],broker[32];int begin;uint64_t epoch,deadline;} Exchange;
static uint64_t clock_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static int received_broker(xpc_object_t message){
 if(!SecCodeCreateWithXPCMessage||!message||xpc_get_type(message)!=XPC_TYPE_DICTIONARY)return 0;
 SecCodeRef code=NULL;SecRequirementRef requirement=NULL;CFStringRef text=CFStringCreateWithCString(NULL,AXIOM_ISSUER_BROKER_REQUIREMENT,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus r=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&requirement);CFRelease(text);if(r!=errSecSuccess||!requirement)return 0;
 r=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);int ok=r==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,requirement)==errSecSuccess;
 if(code)CFRelease(code);CFRelease(requirement);return ok;
}
static void release_session(void*value){AxiomOriginSession*s=value;if(atomic_fetch_sub(&s->refs,1)==1){memset(s->client,0,32);memset(s->broker,0,32);pthread_mutex_destroy(&s->request_lock);if(s->request_wake)dispatch_release(s->request_wake);memset(s->request_bytes,0,sizeof(s->request_bytes));free(s);}}
static void release_exchange(Exchange*x){if(atomic_fetch_sub(&x->refs,1)==1){release_session(x->session);if(x->done)dispatch_release(x->done);free(x);}}
static int exchange(AxiomOriginSession*s,const char*operation,const char*expected,int begin,int fresh){
 if(!s||atomic_load(&s->invalid)||s->self!=getpid())return 0;
 uint64_t start=clock_ns();if(start==UINT64_MAX)return 0;
 Exchange*x=calloc(1,sizeof(*x));if(!x)return 0;atomic_init(&x->refs,2);atomic_init(&x->cancelled,0);atomic_init(&x->success,0);x->session=s;atomic_fetch_add(&s->refs,1);x->done=dispatch_semaphore_create(0);x->begin=begin;
 if(!x->done){release_exchange(x);release_exchange(x);return 0;}
 if(fresh)arc4random_buf(x->client,32);else memcpy(x->client,s->client,32);
 /* Both session challenges remain native private; each live assertion uses
  * its own fresh client nonce instead of replaying the startup exchange. */
 memcpy(x->broker,s->broker,32);
 xpc_object_t message=xpc_dictionary_create(NULL,NULL,0);if(!message){release_exchange(x);release_exchange(x);return 0;}
 xpc_dictionary_set_string(message,"op",operation);xpc_dictionary_set_data(message,"client",x->client,32);if(!begin)xpc_dictionary_set_data(message,"broker",s->broker,32);
 xpc_connection_send_message_with_reply(s->connection,message,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^(xpc_object_t reply){
  if(!atomic_load(&x->cancelled)&&!atomic_load(&s->invalid)&&received_broker(reply)&&xpc_dictionary_get_count(reply)==6){
   const char*status=xpc_dictionary_get_string(reply,"status");size_t na=0,nb=0;const void*a=xpc_dictionary_get_data(reply,"client",&na);const void*b=xpc_dictionary_get_data(reply,"broker",&nb);xpc_object_t child=xpc_dictionary_get_value(reply,"child"),epoch=xpc_dictionary_get_value(reply,"epoch"),deadline=xpc_dictionary_get_value(reply,"deadline");
   if(epoch&&deadline&&xpc_get_type(epoch)==XPC_TYPE_UINT64&&xpc_get_type(deadline)==XPC_TYPE_UINT64&&xpc_uint64_get_value(epoch)>0&&xpc_uint64_get_value(deadline)>0&&(begin||(xpc_uint64_get_value(epoch)==s->epoch&&xpc_uint64_get_value(deadline)==s->deadline))&&status&&!strcmp(status,expected)&&child&&xpc_get_type(child)==XPC_TYPE_INT64&&xpc_int64_get_value(child)==s->self&&a&&b&&na==32&&nb==32&&!memcmp(a,x->client,32)&&(begin||!memcmp(b,x->broker,32))){if(begin){memcpy(x->broker,b,32);x->epoch=xpc_uint64_get_value(epoch);x->deadline=xpc_uint64_get_value(deadline);}atomic_store(&x->success,1);}
  }
  dispatch_semaphore_signal(x->done);release_exchange(x);
 });xpc_release(message);
 int timeout=dispatch_semaphore_wait(x->done,dispatch_time(DISPATCH_TIME_NOW,(int64_t)AXIOM_ORIGIN_EXCHANGE_NS))!=0;
 uint64_t end=clock_ns();if(timeout)atomic_store(&x->cancelled,1);
 int ok=!timeout&&!atomic_load(&s->invalid)&&atomic_load(&x->success)&&end>=start&&end-start<=AXIOM_ORIGIN_EXCHANGE_NS&&s->self==getpid();
 if(ok&&begin){memcpy(s->client,x->client,32);memcpy(s->broker,x->broker,32);s->epoch=x->epoch;s->deadline=x->deadline;}release_exchange(x);return ok;
}
static int start_session(AxiomOriginSession*s){return exchange(s,"begin","challenge",1,1)&&exchange(s,"ack","origin_startup_consumed",0,0);}
void axiom_origin_session_revoke(AxiomOriginSession*s){if(s){atomic_store(&s->invalid,1);if(s->request_wake)dispatch_semaphore_signal(s->request_wake);if(s->connection)xpc_connection_cancel(s->connection);}}
void axiom_origin_session_destroy(void*value){AxiomOriginSession*s=value;if(!s)return;atomic_store(&s->invalid,1);if(s->request_wake)dispatch_semaphore_signal(s->request_wake);if(s->connection){xpc_connection_cancel(s->connection);xpc_release(s->connection);s->connection=NULL;}release_session(s);}
static int receive_request(AxiomOriginSession*,xpc_object_t);
AxiomOriginSession*axiom_origin_session_open(void){
 if(!AXIOM_ISSUER_ORIGIN_SERVICE[0]||!AXIOM_ISSUER_BROKER_REQUIREMENT[0]||!SecCodeCreateWithXPCMessage)return NULL;
 AxiomOriginSession*s=calloc(1,sizeof(*s));if(!s)return NULL;atomic_init(&s->refs,1);atomic_init(&s->invalid,0);atomic_flag_clear(&s->busy);s->self=getpid();pthread_mutex_init(&s->request_lock,NULL);s->request_wake=dispatch_semaphore_create(0);if(!s->request_wake){release_session(s);return NULL;}
 s->connection=xpc_connection_create_mach_service(AXIOM_ISSUER_ORIGIN_SERVICE,NULL,0);if(!s->connection){release_session(s);return NULL;}
 if(xpc_connection_set_peer_code_signing_requirement(s->connection,AXIOM_ISSUER_BROKER_REQUIREMENT)){xpc_connection_set_event_handler(s->connection,^(xpc_object_t event){(void)event;});xpc_connection_activate(s->connection);axiom_origin_session_destroy(s);return NULL;}
 atomic_fetch_add(&s->refs,1);xpc_connection_set_context(s->connection,s);xpc_connection_set_finalizer_f(s->connection,release_session);
 xpc_connection_set_event_handler(s->connection,^(xpc_object_t event){if(!receive_request(s,event))axiom_origin_session_revoke(s);});xpc_connection_activate(s->connection);
 if(!start_session(s)){axiom_origin_session_destroy(s);return NULL;}return s;
}
int axiom_origin_session_locally_valid(AxiomOriginSession*s){return s&&!atomic_load(&s->invalid)&&s->self==getpid();}
int axiom_origin_session_assert(AxiomOriginSession*s){
 if(!s||atomic_load(&s->invalid)||atomic_flag_test_and_set(&s->busy))return 0;
 int ok=exchange(s,"live","origin_current",0,1);if(!ok)atomic_store(&s->invalid,1);atomic_flag_clear(&s->busy);return ok;
}

int axiom_origin_session_bootstrap_binding(AxiomOriginSession*s,uint64_t*epoch,uint64_t*deadline,unsigned char client[32],unsigned char broker[32]){
 if(!epoch||!deadline||!client||!broker||!axiom_origin_session_locally_valid(s)||!s->epoch||clock_ns()>=s->deadline)return 0;
 *epoch=s->epoch;*deadline=s->deadline;memcpy(client,s->client,32);memcpy(broker,s->broker,32);return 1;
}

/* Business events use the existing owned native connection, never origin op dictionaries. */
static int wire_u64(xpc_object_t m,const char*k,uint64_t*out){xpc_object_t v=xpc_dictionary_get_value(m,k);if(!v||xpc_get_type(v)!=XPC_TYPE_UINT64)return 0;*out=xpc_uint64_get_value(v);return 1;}
static int receive_request(AxiomOriginSession*s,xpc_object_t message){
 if(!s||atomic_load(&s->invalid)||!received_broker(message))return 0;
 const char*protocol=xpc_dictionary_get_string(message,"protocol"),*kind=xpc_dictionary_get_string(message,"kind");size_t n=0;const void*id=xpc_dictionary_get_data(message,"id",&n);uint64_t epoch=0,deadline=0;
 if(!protocol||strcmp(protocol,AX_REQUEST_PROTOCOL)||!kind||!id||n!=32||!wire_u64(message,"epoch",&epoch)||epoch!=s->epoch)return 0;
 int ok=0;pthread_mutex_lock(&s->request_lock);
 if(!strcmp(kind,"request")&&xpc_dictionary_get_count(message)==6&&wire_u64(message,"deadline",&deadline)&&deadline<=s->deadline&&clock_ns()<deadline&&!s->request_pending){
  size_t size=0;const void*bytes=xpc_dictionary_get_data(message,"bytes",&size);if(bytes&&size&&size<=AX_REQUEST_INPUT_CAP){s->request_pending=1;s->request_delivered=s->request_cancelled=s->request_cancel_delivered=0;s->request_deadline=deadline;s->request_length=size;memcpy(s->request_id,id,32);memcpy(s->request_bytes,bytes,size);ok=1;}
 }else if(!strcmp(kind,"cancel")&&xpc_dictionary_get_count(message)==4&&s->request_pending&&!memcmp(id,s->request_id,32)){s->request_cancelled=1;ok=1;}else if(!strcmp(kind,"cancel")&&xpc_dictionary_get_count(message)==4&&!memcmp(id,s->retired_id,32)){ok=1;}
 pthread_mutex_unlock(&s->request_lock);if(ok)dispatch_semaphore_signal(s->request_wake);return ok;
}
int axiom_origin_session_next_request(AxiomOriginSession*s,AxiomRequestEvent*out){
 if(!s||!out||s->self!=getpid()||atomic_load(&s->invalid))return 0;
 if(!s->request_ready_sent){s->request_ready_sent=1;xpc_object_t ready=xpc_dictionary_create(NULL,NULL,0);if(!ready)return 0;xpc_dictionary_set_string(ready,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(ready,"kind","ready");xpc_dictionary_set_uint64(ready,"epoch",s->epoch);xpc_connection_send_message(s->connection,ready);xpc_release(ready);}
 for(;;){if(atomic_load(&s->invalid)||clock_ns()>=s->deadline)return 0;pthread_mutex_lock(&s->request_lock);int ready=0;
  if(s->request_pending&&!s->request_delivered){memset(out,0,sizeof(*out));ax_request_id_text(s->request_id,out->id);out->length=s->request_length;memcpy(out->bytes,s->request_bytes,out->length);memset(s->request_bytes,0,sizeof(s->request_bytes));s->request_delivered=1;ready=1;}
  else if(s->request_pending&&s->request_cancelled&&!s->request_cancel_delivered){memset(out,0,sizeof(*out));ax_request_id_text(s->request_id,out->id);out->cancelled=1;s->request_cancel_delivered=1;ready=1;}
  pthread_mutex_unlock(&s->request_lock);if(ready)return 1;
  uint64_t now=clock_ns();if(now>=s->deadline)return 0;if(dispatch_semaphore_wait(s->request_wake,dispatch_time(DISPATCH_TIME_NOW,(int64_t)(s->deadline-now))))return 0;
 }
}
typedef struct{atomic_uint refs;atomic_int cancelled,ok;dispatch_semaphore_t done;AxiomOriginSession*s;unsigned char id[32],nonce[32];uint64_t epoch;} RequestExchange;
static void request_exchange_release(RequestExchange*x){if(atomic_fetch_sub(&x->refs,1)==1){dispatch_release(x->done);release_session(x->s);free(x);}}
static int request_exchange(AxiomOriginSession*s,const unsigned char id[32],const unsigned char*frame,size_t size,int drain){
 if(!s||!id||atomic_load(&s->invalid)||s->self!=getpid())return 0;
 pthread_mutex_lock(&s->request_lock);int local=drain?(!s->request_pending&&!memcmp(id,s->retired_id,32)):(s->request_pending&&s->request_delivered&&!memcmp(id,s->request_id,32)&&(frame||clock_ns()<s->request_deadline));pthread_mutex_unlock(&s->request_lock);if(!local)return 0;
 RequestExchange*x=calloc(1,sizeof(*x));if(!x)return 0;x->done=dispatch_semaphore_create(0);if(!x->done){free(x);return 0;}atomic_init(&x->refs,2);atomic_init(&x->cancelled,0);atomic_init(&x->ok,0);x->s=s;atomic_fetch_add(&s->refs,1);x->epoch=s->epoch;memcpy(x->id,id,32);arc4random_buf(x->nonce,32);
 xpc_object_t message=xpc_dictionary_create(NULL,NULL,0);if(!message){request_exchange_release(x);request_exchange_release(x);return 0;}
 xpc_dictionary_set_string(message,"protocol",AX_REQUEST_PROTOCOL);xpc_dictionary_set_string(message,"kind",drain?"drained":frame?"response":"request_current");xpc_dictionary_set_data(message,"id",id,32);xpc_dictionary_set_uint64(message,"epoch",s->epoch);xpc_dictionary_set_data(message,"nonce",x->nonce,32);if(frame)xpc_dictionary_set_data(message,"bytes",frame,size);
 uint64_t start=clock_ns();xpc_connection_send_message_with_reply(s->connection,message,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^(xpc_object_t reply){
  if(!atomic_load(&x->cancelled)&&!atomic_load(&s->invalid)&&received_broker(reply)&&xpc_dictionary_get_count(reply)==6){
   const char*p=xpc_dictionary_get_string(reply,"protocol"),*status=xpc_dictionary_get_string(reply,"status"),*kind=xpc_dictionary_get_string(reply,"kind");size_t ni=0,nn=0;const void*i=xpc_dictionary_get_data(reply,"id",&ni),*nonce=xpc_dictionary_get_data(reply,"nonce",&nn);uint64_t e=0;
   if(p&&!strcmp(p,AX_REQUEST_PROTOCOL)&&kind&&!strcmp(kind,"request_result")&&status&&!strcmp(status,drain?"drained":frame?"completed":"eligible")&&wire_u64(reply,"epoch",&e)&&e==x->epoch&&ni==32&&nn==32&&i&&nonce&&!memcmp(i,x->id,32)&&!memcmp(nonce,x->nonce,32))atomic_store(&x->ok,1);
  }dispatch_semaphore_signal(x->done);request_exchange_release(x);
 });xpc_release(message);
 int timed=dispatch_semaphore_wait(x->done,dispatch_time(DISPATCH_TIME_NOW,AXIOM_ORIGIN_EXCHANGE_NS))!=0;uint64_t now=clock_ns();if(timed)atomic_store(&x->cancelled,1);int ok=!timed&&now>=start&&now-start<=AXIOM_ORIGIN_EXCHANGE_NS&&!atomic_load(&s->invalid)&&atomic_load(&x->ok);request_exchange_release(x);return ok;
}
int axiom_origin_session_request_current(AxiomOriginSession*s,const unsigned char id[32]){return request_exchange(s,id,NULL,0,0);}
int axiom_origin_session_complete_request(AxiomOriginSession*s,const unsigned char id[32],const unsigned char*frame,size_t size){uint32_t status;size_t length;if(!ax_request_response(frame,size,&status,&length)||!request_exchange(s,id,frame,size,0))return 0;pthread_mutex_lock(&s->request_lock);s->request_pending=0;s->request_length=0;memcpy(s->retired_id,id,32);memset(s->request_bytes,0,sizeof(s->request_bytes));pthread_mutex_unlock(&s->request_lock);return request_exchange(s,id,NULL,0,1);}
