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
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
struct AxiomOriginSession {atomic_uint refs;atomic_int invalid;atomic_flag busy;xpc_connection_t connection;pid_t self;uint64_t epoch,deadline;unsigned char client[32],broker[32];};
typedef struct {atomic_uint refs;atomic_int cancelled;atomic_int success;AxiomOriginSession*session;dispatch_semaphore_t done;unsigned char client[32],broker[32];int begin;uint64_t epoch,deadline;} Exchange;
static uint64_t clock_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static int received_broker(xpc_object_t message){
 if(!SecCodeCreateWithXPCMessage||!message||xpc_get_type(message)!=XPC_TYPE_DICTIONARY)return 0;
 SecCodeRef code=NULL;SecRequirementRef requirement=NULL;CFStringRef text=CFStringCreateWithCString(NULL,AXIOM_ISSUER_BROKER_REQUIREMENT,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus r=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&requirement);CFRelease(text);if(r!=errSecSuccess||!requirement)return 0;
 r=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);int ok=r==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,requirement)==errSecSuccess;
 if(code)CFRelease(code);CFRelease(requirement);return ok;
}
static void release_session(void*value){AxiomOriginSession*s=value;if(atomic_fetch_sub(&s->refs,1)==1){memset(s->client,0,32);memset(s->broker,0,32);free(s);}}
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
void axiom_origin_session_revoke(AxiomOriginSession*s){if(s){atomic_store(&s->invalid,1);if(s->connection)xpc_connection_cancel(s->connection);}}
void axiom_origin_session_destroy(void*value){AxiomOriginSession*s=value;if(!s)return;atomic_store(&s->invalid,1);if(s->connection){xpc_connection_cancel(s->connection);xpc_release(s->connection);s->connection=NULL;}release_session(s);}
AxiomOriginSession*axiom_origin_session_open(void){
 if(!AXIOM_ISSUER_ORIGIN_SERVICE[0]||!AXIOM_ISSUER_BROKER_REQUIREMENT[0]||!SecCodeCreateWithXPCMessage)return NULL;
 AxiomOriginSession*s=calloc(1,sizeof(*s));if(!s)return NULL;atomic_init(&s->refs,1);atomic_init(&s->invalid,0);atomic_flag_clear(&s->busy);s->self=getpid();
 s->connection=xpc_connection_create_mach_service(AXIOM_ISSUER_ORIGIN_SERVICE,NULL,0);if(!s->connection){release_session(s);return NULL;}
 if(xpc_connection_set_peer_code_signing_requirement(s->connection,AXIOM_ISSUER_BROKER_REQUIREMENT)){xpc_connection_set_event_handler(s->connection,^(xpc_object_t event){(void)event;});xpc_connection_activate(s->connection);axiom_origin_session_destroy(s);return NULL;}
 atomic_fetch_add(&s->refs,1);xpc_connection_set_context(s->connection,s);xpc_connection_set_finalizer_f(s->connection,release_session);
 xpc_connection_set_event_handler(s->connection,^(xpc_object_t event){(void)event;atomic_store(&s->invalid,1);});xpc_connection_activate(s->connection);
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
