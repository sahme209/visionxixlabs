/* Fixed local startup/observation controller for the later full qualification
 * harness. Not an issuer, no provider endpoint, no service registration API.
 * Never execute against a real service without the exact run authorization. */
#import <Foundation/Foundation.h>
#include "origin_config.h"
#include "fixture_qualification_controller.h"
#include "origin_runtime_protocol.h"
#include <Security/Security.h>
#include <xpc/xpc.h>
#include <dispatch/dispatch.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
typedef struct {atomic_uint refs;atomic_int cancelled;atomic_int success;dispatch_semaphore_t done;} ReplyState;
static void release(ReplyState*s){if(atomic_fetch_sub(&s->refs,1)==1){dispatch_release(s->done);free(s);}}
static int actual_sender(xpc_object_t message,const char*text){
 if(!SecCodeCreateWithXPCMessage||xpc_get_type(message)!=XPC_TYPE_DICTIONARY)return 0;CFStringRef string=CFStringCreateWithCString(NULL,text,kCFStringEncodingUTF8);if(!string)return 0;SecRequirementRef requirement=NULL;SecCodeRef code=NULL;OSStatus status=SecRequirementCreateWithString(string,kSecCSDefaultFlags,&requirement);CFRelease(string);if(status!=errSecSuccess||!requirement)return 0;status=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);int ok=status==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,requirement)==errSecSuccess;if(code)CFRelease(code);CFRelease(requirement);return ok;
}
int main(int argc,const char**argv){@autoreleasepool{
 if(argc==2&&!strcmp(argv[1],"--qualification-reviewed-issuer"))return ax_fixture_qualification_controller();
 if(argc!=3||!AXIOM_ISSUER_ORIGIN_SERVICE[0]||strlen(argv[2])>1024)return 64;
 const char*operation=NULL,*expected=NULL;int64_t timeout;
 if(!strcmp(argv[1],"--start-reviewed-issuer")){operation="start";expected="spawned_origin_only";timeout=(int64_t)AXIOM_ORIGIN_STARTUP_NS;}
 else if(!strcmp(argv[1],"--observe-reviewed-issuer")){operation="observe";expected="origin_observed_no_issuer_identity";timeout=1000000000LL;}
 else return 64;
 /* argv[2] is the exact requirement recorded by the owning preparation/harness,
  * not an executable/root/PID or issuer permission. Native issuer peers pin the
  * actual broker independently and cannot be initialized by this controller. */
 const char*requirement=argv[2];xpc_connection_t connection=xpc_connection_create_mach_service(AXIOM_ISSUER_ORIGIN_SERVICE,NULL,0);if(!connection)return 70;
 if(xpc_connection_set_peer_code_signing_requirement(connection,requirement)){xpc_connection_set_event_handler(connection,^(xpc_object_t value){(void)value;});xpc_connection_activate(connection);xpc_connection_cancel(connection);xpc_release(connection);return 71;}
 xpc_connection_set_event_handler(connection,^(xpc_object_t value){(void)value;});xpc_connection_activate(connection);
 ReplyState*s=calloc(1,sizeof(*s));if(!s){xpc_connection_cancel(connection);xpc_release(connection);return 72;}atomic_init(&s->refs,2);atomic_init(&s->cancelled,0);atomic_init(&s->success,0);s->done=dispatch_semaphore_create(0);if(!s->done){free(s);xpc_connection_cancel(connection);xpc_release(connection);return 72;}
 xpc_object_t message=xpc_dictionary_create(NULL,NULL,0);if(!message){release(s);release(s);xpc_connection_cancel(connection);xpc_release(connection);return 72;}xpc_dictionary_set_string(message,"op",operation);
 xpc_connection_send_message_with_reply(connection,message,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^(xpc_object_t reply){if(!atomic_load(&s->cancelled)&&actual_sender(reply,requirement)&&xpc_dictionary_get_count(reply)==2){const char*status=xpc_dictionary_get_string(reply,"status");if(status&&!strcmp(status,expected))atomic_store(&s->success,1);}dispatch_semaphore_signal(s->done);release(s);});xpc_release(message);
 int expired=dispatch_semaphore_wait(s->done,dispatch_time(DISPATCH_TIME_NOW,timeout))!=0;if(expired)atomic_store(&s->cancelled,1);int ok=!expired&&atomic_load(&s->success);xpc_connection_cancel(connection);xpc_release(connection);release(s);
 if(ok)puts(!strcmp(operation,"start")?"fixed_origin_spawn_requested; issuerIdentity=unavailable":"current_origin_observed; issuerIdentity=unavailable");return ok?0:73;
}}
