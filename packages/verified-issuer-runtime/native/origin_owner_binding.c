/* Prepared native client. No caller-provided identity/configuration; actual OS
 * and installed owner qualification remain separate. Default gate is closed. */
#define _DARWIN_C_SOURCE 1
#include "origin_owner_binding.h"
#include "owner_protocol.h"
#include "owner_config.h"
#include <xpc/xpc.h>
#include <Security/Security.h>
#include <dispatch/dispatch.h>
#include <stdatomic.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
static pthread_mutex_t lock=PTHREAD_MUTEX_INITIALIZER;
static atomic_int attempted,revoked;
/* Retained for the process lifetime, including late XPC callbacks. Never freed
 * from a cancellation race and never replaced/reconnected. */
static _Atomic(uintptr_t) connection_ref;
static dispatch_queue_t callback_queue;
static AxOwnerClient client;
/* Accessed only while lock is held; binds late signature validation to the
 * same individual request, not a new timeout after receiving bytes. */
static uint64_t response_deadline;
typedef struct {atomic_uint refs;atomic_int cancelled;dispatch_semaphore_t ready;xpc_object_t value;uint64_t deadline;} Reply;
static uint64_t now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static void reply_release(Reply*r){if(atomic_fetch_sub(&r->refs,1)==1){if(r->value)xpc_release(r->value);dispatch_release(r->ready);free(r);}}
static int message_matches(xpc_object_t message){
 if(!SecCodeCreateWithXPCMessage||!message||xpc_get_type(message)!=XPC_TYPE_DICTIONARY||!AX_OWNER_REQUIREMENT[0])return 0;
 SecCodeRef code=NULL;SecRequirementRef req=NULL;CFStringRef text=CFStringCreateWithCString(NULL,AX_OWNER_REQUIREMENT,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus status=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&req);CFRelease(text);if(status!=errSecSuccess||!req)return 0;
 status=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);int ok=status==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,req)==errSecSuccess;if(code)CFRelease(code);CFRelease(req);return ok;
}
void axiom_owner_binding_revoke(void){atomic_store(&revoked,1);xpc_connection_t c=(xpc_connection_t)atomic_load(&connection_ref);if(c)xpc_connection_cancel(c);}
static xpc_object_t exchange(xpc_object_t request){
 if(atomic_load(&revoked))return NULL;uint64_t now=now_ns();if(now==UINT64_MAX||now>UINT64_MAX-AX_OWNER_REQUEST_NS)return NULL;
 Reply*r=calloc(1,sizeof(*r));if(!r)return NULL;atomic_init(&r->refs,2);atomic_init(&r->cancelled,0);r->deadline=now+AX_OWNER_REQUEST_NS;response_deadline=r->deadline;r->ready=dispatch_semaphore_create(0);if(!r->ready){free(r);return NULL;}
 xpc_connection_t c=(xpc_connection_t)atomic_load(&connection_ref);if(!c){atomic_store(&r->refs,1);reply_release(r);return NULL;}
 xpc_connection_send_message_with_reply(c,request,callback_queue,^(xpc_object_t value){
  if(!atomic_load(&r->cancelled)&&!atomic_load(&revoked)&&now_ns()<r->deadline&&value&&xpc_get_type(value)==XPC_TYPE_DICTIONARY)r->value=xpc_retain(value);
  dispatch_semaphore_signal(r->ready);reply_release(r);
 });
 long waited=dispatch_semaphore_wait(r->ready,dispatch_time(DISPATCH_TIME_NOW,(int64_t)AX_OWNER_REQUEST_NS));
 /* A reply arriving at/after the deadline is always uncertain/refused. */
 atomic_store(&r->cancelled,1);xpc_object_t value=NULL;if(!waited&&!atomic_load(&revoked)&&now_ns()<r->deadline&&r->value)value=xpc_retain(r->value);reply_release(r);return value;
}
static int generation(unsigned char out[16]){const char*s=AX_SYNTH_GENERATION;if(strlen(s)!=32)return 0;for(size_t i=0;i<16;i++){unsigned v=0;for(size_t j=0;j<2;j++){unsigned char c=(unsigned char)s[i*2+j];if(c>='0'&&c<='9')v=v*16+(c-'0');else if(c>='a'&&c<='f')v=v*16+(c-'a'+10);else return 0;}out[i]=(unsigned char)v;}return 1;}
static xpc_object_t request(const char*op,uint64_t seq){
 xpc_object_t r=xpc_dictionary_create(NULL,NULL,0);if(!r)return NULL;xpc_dictionary_set_string(r,"op",op);xpc_dictionary_set_data(r,"generation",client.generation,16);xpc_dictionary_set_data(r,"client",client.client,32);
 if(strcmp(op,"begin")){xpc_dictionary_set_data(r,"owner",client.owner,32);xpc_dictionary_set_uint64(r,"sequence",seq);}return r;
}
static int validate(xpc_object_t r,const char*status,int stage){
 if(!r||now_ns()>=response_deadline||!message_matches(r)||now_ns()>=response_deadline||xpc_dictionary_get_count(r)!=6)return 0;
 const char*s=xpc_dictionary_get_string(r,"status");xpc_object_t pid_value=xpc_dictionary_get_value(r,"child"),seq_value=xpc_dictionary_get_value(r,"sequence");
 if(!s||strcmp(s,status)||!pid_value||xpc_get_type(pid_value)!=XPC_TYPE_INT64||!seq_value||xpc_get_type(seq_value)!=XPC_TYPE_UINT64)return 0;
 int64_t child=xpc_dictionary_get_int64(r,"child");if(child<=0||child!=getpid())return 0;
 size_t ng=0,nc=0,nb=0;const void*g=xpc_dictionary_get_data(r,"generation",&ng),*c=xpc_dictionary_get_data(r,"client",&nc),*b=xpc_dictionary_get_data(r,"owner",&nb);if(ng!=16||nc!=32||nb!=32||!g||!c||!b)return 0;
 uint64_t seq=xpc_dictionary_get_uint64(r,"sequence");if(now_ns()>=response_deadline||atomic_load(&revoked))return 0;
 if(stage==0)return ax_owner_client_pending(&client,1,(pid_t)child,g,c,b,seq);
 if(stage==1)return ax_owner_client_confirm(&client,1,(pid_t)child,g,c,b,seq);
 return ax_owner_client_live(&client,1,(pid_t)child,g,c,b,seq);
}
int axiom_owner_binding_startup(void){
 if(atomic_exchange(&attempted,1))return 0;
 /* No platform/credential call before these closed source-preparation checks. */
 if(!AX_OWNER_OPERATIONAL||!AX_OWNER_REQUIREMENT[0]||!AX_OWNER_BROKER_REQUIREMENT[0]||AX_OWNER_FIXED_UID==0||AX_OWNER_FIXED_GID==0||AX_OWNER_MAX_LIFETIME_NS==0||atomic_load(&revoked))return 0;
 if(pthread_mutex_trylock(&lock)){axiom_owner_binding_revoke();return 0;}int ok=0;unsigned char g[16],challenge[32];
 if(getuid()!=AX_OWNER_FIXED_UID||geteuid()!=AX_OWNER_FIXED_UID||getgid()!=AX_OWNER_FIXED_GID||getegid()!=AX_OWNER_FIXED_GID||!generation(g))goto done;
 arc4random_buf(challenge,sizeof(challenge));if(!ax_owner_client_prepare(&client,getpid(),g,challenge))goto done;
 callback_queue=dispatch_queue_create("axiom.issuer.owner.reply",DISPATCH_QUEUE_SERIAL);if(!callback_queue)goto done;
 xpc_connection_t c=xpc_connection_create_mach_service(AX_OWNER_SERVICE,callback_queue,XPC_CONNECTION_MACH_SERVICE_PRIVILEGED);if(!c)goto done;atomic_store(&connection_ref,(uintptr_t)c);
 if(xpc_connection_set_peer_code_signing_requirement(c,AX_OWNER_REQUIREMENT))goto done;
 xpc_connection_set_event_handler(c,^(xpc_object_t event){(void)event;axiom_owner_binding_revoke();});xpc_connection_activate(c);
 xpc_object_t q=request("begin",0),r=q?exchange(q):NULL;if(q)xpc_release(q);if(!validate(r,"owner_pending",0)){if(r)xpc_release(r);goto done;}xpc_release(r);
 q=request("ack",0);r=q?exchange(q):NULL;if(q)xpc_release(q);if(!validate(r,"owner_authenticated",1)){if(r)xpc_release(r);goto done;}xpc_release(r);ok=!atomic_load(&revoked);
 done:if(!ok){ax_owner_client_revoke(&client);axiom_owner_binding_revoke();}pthread_mutex_unlock(&lock);return ok;
}
int axiom_owner_binding_current(void){
 if(!AX_OWNER_OPERATIONAL||atomic_load(&revoked)||!atomic_load(&attempted))return 0;
 if(pthread_mutex_trylock(&lock)){axiom_owner_binding_revoke();return 0;}int ok=0;uint64_t seq;
 if(!ax_owner_client_next(&client,&seq))goto done;
 xpc_object_t q=request("live",seq),r=q?exchange(q):NULL;if(q)xpc_release(q);ok=validate(r,"owner_current",2)&&!atomic_load(&revoked);if(r)xpc_release(r);
 done:if(!ok){ax_owner_client_revoke(&client);axiom_owner_binding_revoke();}pthread_mutex_unlock(&lock);return ok;
}
