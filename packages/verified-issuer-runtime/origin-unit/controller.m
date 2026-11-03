#import <Foundation/Foundation.h>
#include "config.h"
#include "peer.h"
#include <dispatch/dispatch.h>
#include <string.h>
#include <unistd.h>
static int request(xpc_connection_t c,const char*operation,const char*requirement){
 dispatch_semaphore_t done=dispatch_semaphore_create(0);__block int status=-1;
 xpc_object_t m=xpc_dictionary_create(NULL,NULL,0);xpc_dictionary_set_string(m,"op",operation);
 xpc_connection_send_message_with_reply(c,m,dispatch_get_global_queue(QOS_CLASS_USER_INITIATED,0),^(xpc_object_t reply){if(origin_message_matches(reply,requirement)){const char*s=xpc_dictionary_get_string(reply,"status");if(s){if(!strcmp(s,"spawned_component_only"))status=1;else if(!strcmp(s,"component_observed_no_identity"))status=2;else if(!strcmp(s,"pending_component_only"))status=0;else status=-1;}}dispatch_semaphore_signal(done);});xpc_release(m);
 if(dispatch_semaphore_wait(done,dispatch_time(DISPATCH_TIME_NOW,1000000000LL)))return -1;return status;
}
int main(int argc,const char**argv){@autoreleasepool{
 if(argc!=3||strcmp(argv[1],"--test-reviewed-unit"))return 64;
 const char*requirement=argv[2];xpc_connection_t c=xpc_connection_create_mach_service(UNIT_SERVICE,NULL,0);if(!c||xpc_connection_set_peer_code_signing_requirement(c,requirement))return 72;
 xpc_connection_set_event_handler(c,^(xpc_object_t event){(void)event;});xpc_connection_activate(c);
 int result=request(c,"start",requirement);if(result!=1){xpc_connection_cancel(c);return 73;}
 for(unsigned i=0;i<15;i++){usleep(100000);result=request(c,"observe_component",requirement);if(result==2){puts("component_observed; executingIssuerIdentity=unavailable");xpc_connection_cancel(c);return 0;}if(result<0)break;}
 xpc_connection_cancel(c);return 74;
}}
