#define _DARWIN_C_SOURCE 1
#include "config.h"
#include "peer.h"
#include "unit_deadline.h"
#include <node_api.h>
#include <dispatch/dispatch.h>
#include <mach-o/dyld.h>
#include <crt_externs.h>
#include <dlfcn.h>
#include <unistd.h>
#include <stdlib.h>
#include <limits.h>
#include <string.h>
#include <stdatomic.h>
static atomic_flag attempted=ATOMIC_FLAG_INIT;
static int fixed_invocation(void){
 char executable[PATH_MAX],resolved[PATH_MAX];uint32_t size=sizeof(executable);if(_NSGetExecutablePath(executable,&size)||!realpath(executable,resolved)||strcmp(resolved,UNIT_NODE))return 0;
 int argc=*_NSGetArgc();char**argv=*_NSGetArgv();if(argc!=2||strcmp(argv[1],UNIT_MAIN))return 0;
 Dl_info image;if(!dladdr((void*)&fixed_invocation,&image)||!image.dli_fname||!realpath(image.dli_fname,resolved)||strcmp(resolved,UNIT_ADDON))return 0;
 for(char**e=*_NSGetEnviron();*e;e++){const char*p=*e;if(!strncmp(p,"NODE_",5)||!strncmp(p,"DYLD_",5)||!strncmp(p,"LD_",3)||!strncmp(p,"TS_NODE_",8))return 0;}return 1;
}
typedef struct {atomic_uint refs;atomic_int invalid;} Session;
static void session_release(void*p){Session*s=p;if(atomic_fetch_sub(&s->refs,1)==1)free(s);}
typedef struct {atomic_uint refs;atomic_int cancelled;atomic_int success;Session*session;dispatch_semaphore_t done;unsigned char client[32],broker[32];int begin;} Exchange;
static void exchange_release(Exchange*c){if(atomic_fetch_sub(&c->refs,1)==1){session_release(c->session);if(c->done)dispatch_release(c->done);free(c);}}
static int exchange(xpc_connection_t connection,Session*session,const char*op,unsigned char client[32],unsigned char broker[32],const char*expected){
 if(atomic_load(&session->invalid))return 0;Exchange*context=calloc(1,sizeof(*context));if(!context)return 0;
 atomic_init(&context->refs,2);atomic_init(&context->cancelled,0);atomic_init(&context->success,0);context->session=session;atomic_fetch_add(&session->refs,1);context->done=dispatch_semaphore_create(0);if(!context->done){exchange_release(context);exchange_release(context);return 0;}context->begin=!strcmp(op,"begin");memcpy(context->client,client,32);memcpy(context->broker,broker,32);
 xpc_object_t message=xpc_dictionary_create(NULL,NULL,0);if(!message){exchange_release(context);exchange_release(context);return 0;}xpc_dictionary_set_string(message,"op",op);xpc_dictionary_set_data(message,"client",client,32);if(!context->begin)xpc_dictionary_set_data(message,"broker",broker,32);
 xpc_connection_send_message_with_reply(connection,message,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^(xpc_object_t reply){
  if(!atomic_load(&context->cancelled)&&!atomic_load(&session->invalid)&&origin_message_matches(reply,BROKER_REQUIREMENT)){
   const char*status=xpc_dictionary_get_string(reply,"status");size_t na=0,nb=0;const void*a=xpc_dictionary_get_data(reply,"client",&na);const void*b=xpc_dictionary_get_data(reply,"broker",&nb);
   if(status&&!strcmp(status,expected)&&xpc_dictionary_get_int64(reply,"child")==getpid()&&a&&b&&na==32&&nb==32&&!memcmp(a,context->client,32)){
    if(context->begin){memcpy(context->broker,b,32);atomic_store(&context->success,1);}else if(!memcmp(context->broker,b,32))atomic_store(&context->success,1);
   }
  }
  dispatch_semaphore_signal(context->done);exchange_release(context);
 });xpc_release(message);
 int timed_out=dispatch_semaphore_wait(context->done,dispatch_time(DISPATCH_TIME_NOW,5000000000LL))!=0;
 if(timed_out)atomic_store(&context->cancelled,1);
 int success=!timed_out&&!atomic_load(&session->invalid)&&atomic_load(&context->success);
 if(success&&context->begin)memcpy(broker,context->broker,32);exchange_release(context);return success;
}
static void close_inactive(xpc_connection_t c){if(!c)return;xpc_connection_set_event_handler(c,^(xpc_object_t event){(void)event;});xpc_connection_activate(c);xpc_connection_cancel(c);xpc_release(c);}
static napi_value initialize(napi_env env,napi_value exports){
 if(atomic_flag_test_and_set(&attempted)||!fixed_invocation()){napi_throw_error(env,NULL,"origin_unit_fixed_fresh_invocation_required");return NULL;}
 /* Diagnostic unit only: broker death/SIGKILL cannot leave this fixture alive indefinitely.
  * No production runtime lifetime is authorized by this independent self deadline. */
 origin_unit_self_deadline();
 xpc_connection_t connection=xpc_connection_create_mach_service(UNIT_SERVICE,NULL,0);if(!connection||xpc_connection_set_peer_code_signing_requirement(connection,BROKER_REQUIREMENT)){close_inactive(connection);napi_throw_error(env,NULL,"origin_unit_peer_requirement_unavailable");return NULL;}
 Session*session=calloc(1,sizeof(*session));if(!session){close_inactive(connection);napi_throw_error(env,NULL,"origin_unit_session_unavailable");return NULL;}atomic_init(&session->refs,2);atomic_init(&session->invalid,0);xpc_connection_set_context(connection,session);xpc_connection_set_finalizer_f(connection,session_release);
 xpc_connection_set_event_handler(connection,^(xpc_object_t event){(void)event;atomic_store(&session->invalid,1);});xpc_connection_activate(connection);
 unsigned char client[32],broker[32]={0};arc4random_buf(client,32);
 int ok=exchange(connection,session,"begin",client,broker,"challenge")&&exchange(connection,session,"ack",client,broker,"component_only_no_identity");
 xpc_connection_cancel(connection);xpc_release(connection);session_release(session);
 if(!ok){napi_throw_error(env,NULL,"origin_unit_handshake_unavailable");return NULL;}
 /* Unit protocol success grants NO executing identity; canonical runtime is untouched. */
 if(napi_object_freeze(env,exports)!=napi_ok){napi_throw_error(env,NULL,"origin_unit_freeze_failed");return NULL;}return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,initialize)
