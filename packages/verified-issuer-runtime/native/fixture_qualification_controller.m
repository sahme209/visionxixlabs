/* Fixed six-operation synthetic qualification client. No public descriptor,
 * identity mint, seventh operation, provider endpoint or authority setter. */
#import <Foundation/Foundation.h>
#include "fixture_qualification_controller.h"
#include "fixture_controller_state.h"
#include "fixture_controller_wire.h"
#include "fixture_authorization_frame.h"
#include "system_peer_binding.h"
#include "owner_config.h"
#include "origin_config.h"
#include "request_protocol.h"
#include <Security/Security.h>
#include <xpc/xpc.h>
#include <dispatch/dispatch.h>
#include <mach-o/dyld.h>
#include <stdatomic.h>
#include <poll.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <time.h>
#include <math.h>
#include <string.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
/* One invocation per fixed controller process. Static lifetime prevents late
 * asynchronous callbacks from reaching freed frame/token or reply state. */
static struct {AxFixtureControllerState state;AxSystemPeer self,broker;dispatch_queue_t queue;dispatch_semaphore_t changed;xpc_connection_t origin,request;uint64_t deadline;int stopped,completed,admitted;unsigned char id[32],response[AX_REQUEST_FRAME_CAP];size_t response_length;} run;
static uint64_t now_ms(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000+(uint64_t)t.tv_nsec/1000000;}
static int io(int fd,unsigned char*p,size_t n,int writing){while(n){uint64_t now=now_ms();if(now>=run.deadline)return 0;struct pollfd item={fd,writing?POLLOUT:POLLIN,0};int r=poll(&item,1,(int)(run.deadline-now));if(r<0&&errno==EINTR)continue;if(r<=0||item.revents&(POLLERR|POLLNVAL))return 0;ssize_t got=writing?write(fd,p,n>4096?4096:n):read(fd,p,n);if(got<0&&(errno==EINTR||errno==EAGAIN||errno==EWOULDBLOCK))continue;if(got<=0)return 0;p+=got;n-=(size_t)got;}return 1;}
static void stop(void){run.stopped=1;ax_fixture_controller_stop(&run.state);dispatch_semaphore_signal(run.changed);}
static int sender(xpc_object_t value){const char*text=ax_system_peer_requirement(&run.broker);if(!text||!SecCodeCreateWithXPCMessage||xpc_get_type(value)!=XPC_TYPE_DICTIONARY)return 0;CFStringRef string=CFStringCreateWithCString(NULL,text,kCFStringEncodingUTF8);SecRequirementRef requirement=NULL;SecCodeRef code=NULL;int ok=string&&SecRequirementCreateWithString(string,kSecCSDefaultFlags,&requirement)==errSecSuccess&&requirement&&SecCodeCreateWithXPCMessage(value,kSecCSDefaultFlags,&code)==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,requirement)==errSecSuccess;if(code)CFRelease(code);if(requirement)CFRelease(requirement);if(string)CFRelease(string);return ok&&ax_system_peer_current(&run.self)&&now_ms()<run.deadline;}
static int current(void){__block int ok=0;dispatch_sync(run.queue,^{ok=!run.stopped&&now_ms()<run.deadline&&ax_system_peer_current(&run.self)&&ax_system_peer_current(&run.broker);});return ok;}
static int wait_for(int readiness){for(;;){__block int done=0,failed=0;dispatch_sync(run.queue,^{failed=run.stopped;done=readiness?ax_fixture_controller_can_request(&run.state):run.completed;});if(failed||!current())return 0;if(done)return 1;uint64_t now=now_ms();if(now>=run.deadline||dispatch_semaphore_wait(run.changed,dispatch_time(DISPATCH_TIME_NOW,(int64_t)(run.deadline-now)*1000000))){dispatch_sync(run.queue,^{stop();});return 0;}}}
static int own_loaded_file(void){char path[4096];uint32_t n=sizeof path;return AX_FIXTURE_CONTROLLER_UID>0&&AX_FIXTURE_CONTROLLER_GID>0&&getuid()==AX_FIXTURE_CONTROLLER_UID&&geteuid()==AX_FIXTURE_CONTROLLER_UID&&getgid()==AX_FIXTURE_CONTROLLER_GID&&getegid()==AX_FIXTURE_CONTROLLER_GID&&!_NSGetExecutablePath(path,&n)&&!strcmp(path,AX_SYNTH_APP "/Contents/MacOS/AxiomIssuerController")&&ax_system_peer_prepare(&run.self,AX_SYSTEM_PEER_CONTROLLER)&&ax_system_peer_prepare(&run.broker,AX_SYSTEM_PEER_BROKER);}
static int open_connections(void){const char*requirement=ax_system_peer_requirement(&run.broker);if(!requirement)return 0;run.origin=xpc_connection_create_mach_service(AXIOM_ISSUER_ORIGIN_SERVICE,run.queue,0);run.request=xpc_connection_create_mach_service(AXIOM_ISSUER_REQUEST_SERVICE,run.queue,0);if(!run.origin||!run.request||xpc_connection_set_peer_code_signing_requirement(run.origin,requirement)||xpc_connection_set_peer_code_signing_requirement(run.request,requirement))return 0;
 xpc_connection_set_event_handler(run.origin,^(xpc_object_t value){const char*p=xpc_get_type(value)==XPC_TYPE_DICTIONARY?xpc_dictionary_get_string(value,"protocol"):NULL,*s=xpc_get_type(value)==XPC_TYPE_DICTIONARY?xpc_dictionary_get_string(value,"status"):NULL;int exact=xpc_get_type(value)==XPC_TYPE_DICTIONARY&&xpc_dictionary_get_count(value)==2&&p&&s&&!strcmp(p,"axiom.issuer-control-observation/1")&&!strcmp(s,"business_ready_no_action_authority");if(!ax_fixture_controller_notice(&run.state,sender(value),exact))stop();dispatch_semaphore_signal(run.changed);});
 xpc_connection_set_event_handler(run.request,^(xpc_object_t value){if(!sender(value)||run.admitted||run.completed||xpc_dictionary_get_count(value)!=2){stop();return;}const char*s=xpc_dictionary_get_string(value,"status");size_t n=0;const void*id=xpc_dictionary_get_data(value,"id",&n);if(!s||strcmp(s,"admitted")||!id||n!=32){stop();return;}memcpy(run.id,id,32);run.admitted=1;});
 xpc_connection_activate(run.origin);xpc_connection_activate(run.request);xpc_object_t start=xpc_dictionary_create(NULL,NULL,0);if(!start)return 0;xpc_dictionary_set_string(start,"op","start");xpc_connection_send_message_with_reply(run.origin,start,run.queue,^(xpc_object_t value){const char*s=xpc_get_type(value)==XPC_TYPE_DICTIONARY?xpc_dictionary_get_string(value,"status"):NULL;int exact=xpc_get_type(value)==XPC_TYPE_DICTIONARY&&xpc_dictionary_get_count(value)==2&&s&&!strcmp(s,"spawned_origin_only");if(!ax_fixture_controller_started(&run.state,sender(value),exact))stop();dispatch_semaphore_signal(run.changed);});xpc_release(start);return wait_for(1);
}
static int exact_number(id value,int expected){if(![value isKindOfClass:[NSNumber class]]||CFGetTypeID((CFTypeRef)value)==CFBooleanGetTypeID())return 0;double n=[value doubleValue];return isfinite(n)&&n==(double)expected;}
static int accepted(AxFixtureCase c,const unsigned char*response,size_t length){uint32_t status=0;size_t body=0;if(!ax_request_response(response,length,&status,&body))return 0;NSData*data=[NSData dataWithBytes:response+8 length:body];id decoded=[NSJSONSerialization JSONObjectWithData:data options:0 error:NULL];if(![decoded isKindOfClass:[NSDictionary class]])return 0;
 if(c==AX_FIXTURE_REVOKE_BEFORE_CLAIM){id error=[decoded objectForKey:@"error"];return status==409&&([error isEqual:@"provider_execution_refresh_required"]||([error isKindOfClass:[NSDictionary class]]&&[[error objectForKey:@"code"]isEqual:@"provider_execution_refresh_required"]));}
 id payload=[decoded objectForKey:@"data"];if(status!=200||![payload isKindOfClass:[NSDictionary class]])return 0;id operation=[payload objectForKey:@"operation"];
 if(c==AX_FIXTURE_READ_EXECUTION)return operation==[NSNull null];if(![operation isKindOfClass:[NSDictionary class]])return 0;
 id state=[operation objectForKey:@"state"],attempt=[operation objectForKey:@"attemptCount"],version=[operation objectForKey:@"version"];if(![attempt isKindOfClass:[NSNumber class]]||![version isKindOfClass:[NSNumber class]])return 0;
 const char*expected="prepared";int attempts=0,revision=0;
 if(c==AX_FIXTURE_EXECUTE_ENROLLED){expected="confirmed";attempts=1;revision=2;}
 else if(c==AX_FIXTURE_CANCEL_PREPARED){expected="cancelled";revision=1;}
 else if(c==AX_FIXTURE_EXECUTE_UNKNOWN||c==AX_FIXTURE_RECOVER_UNKNOWN){expected="unknown";attempts=1;revision=2;}
 else if(c==AX_FIXTURE_REVOKE_AFTER_AWAIT||c==AX_FIXTURE_REVOKE_BEFORE_SEND){expected="refused";attempts=1;revision=2;}
 return[state isEqual:[NSString stringWithUTF8String:expected]]&&exact_number(attempt,attempts)&&exact_number(version,revision);
}
static int scenario(const AxFixtureAuthorization*auth,size_t index){unsigned char bytes[4096];size_t n=0;unsigned budget;if(!wait_for(1)||!current()||!ax_fixture_scenario_request(auth,index,bytes,sizeof bytes,&n,&budget))return 0;dispatch_sync(run.queue,^{if(!ax_fixture_controller_take_ready(&run.state)){stop();return;}run.admitted=run.completed=0;run.response_length=0;memset(run.id,0,sizeof run.id);});if(!current())return 0;xpc_object_t request=xpc_dictionary_create(NULL,NULL,0);if(!request)return 0;xpc_dictionary_set_string(request,"protocol","axiom.issuer-request/1");xpc_dictionary_set_string(request,"kind","request");xpc_dictionary_set_data(request,"bytes",bytes,n);xpc_dictionary_set_uint64(request,"budgetMs",budget);memset(bytes,0,sizeof bytes);
 xpc_connection_send_message_with_reply(run.request,request,run.queue,^(xpc_object_t value){if(!sender(value)||run.completed||xpc_dictionary_get_count(value)!=2){stop();return;}const char*s=xpc_dictionary_get_string(value,"status");size_t count=0;const void*data=xpc_dictionary_get_data(value,"bytes",&count);if(!run.admitted||!s||strcmp(s,"completed")||!data||count>sizeof run.response){stop();return;}memcpy(run.response,data,count);run.response_length=count;run.completed=1;dispatch_semaphore_signal(run.changed);});xpc_release(request);
 if(!wait_for(0)){dispatch_sync(run.queue,^{if(run.admitted){xpc_object_t cancel=xpc_dictionary_create(NULL,NULL,0);if(cancel){xpc_dictionary_set_string(cancel,"protocol","axiom.issuer-request/1");xpc_dictionary_set_string(cancel,"kind","cancel");xpc_dictionary_set_data(cancel,"id",run.id,32);xpc_connection_send_message(run.request,cancel);xpc_release(cancel);}}});return 0;}
 int ok=accepted(auth->scenarios[index].case_id,run.response,run.response_length);memset(run.response,0,sizeof run.response);return ok&&wait_for(1);
}
int ax_fixture_qualification_controller(void){@autoreleasepool{
 unsigned char hello[AX_FIXTURE_HELLO_SIZE],echo[AX_FIXTURE_ECHO_SIZE],frame[AX_FIXTURE_AUTH_FRAME_MAX];AxFixtureAuthorization auth={0};int ok=0;run.deadline=now_ms()+60000;run.queue=dispatch_queue_create("com.visionxixlabs.axiom.qualification-controller",DISPATCH_QUEUE_SERIAL);run.changed=dispatch_semaphore_create(0);if(!run.queue||!run.changed||!own_loaded_file())goto finish;
 int input_flags=fcntl(3,F_GETFL),output_flags=fcntl(4,F_GETFL);if(input_flags<0||output_flags<0||fcntl(3,F_SETFL,input_flags|O_NONBLOCK)||fcntl(4,F_SETFL,output_flags|O_NONBLOCK))goto finish;
 int flag=1;if(fcntl(4,F_SETNOSIGPIPE,flag)||!io(3,hello,sizeof hello,0)||memcmp(hello,AX_FIXTURE_HELLO,8)||memcmp(hello+8,AX_SYNTH_GENERATION,32))goto finish;
 run.deadline=0;for(unsigned i=0;i<8;i++)run.deadline=(run.deadline<<8)|hello[72+i];if(now_ms()>=run.deadline)goto finish;memcpy(echo,AX_FIXTURE_ECHO,8);memcpy(echo+8,hello+40,32);if(!io(4,echo,sizeof echo,1)||!io(3,frame,44,0))goto finish;
 size_t payload=((size_t)frame[40]<<24)|((size_t)frame[41]<<16)|((size_t)frame[42]<<8)|frame[43];if(payload>AX_FIXTURE_AUTH_PAYLOAD_MAX||!io(3,frame+44,payload,0))goto finish;{unsigned char extra;struct pollfd end={3,POLLIN,0};uint64_t at=now_ms();if(at>=run.deadline||poll(&end,1,(int)(run.deadline-at))<=0||read(3,&extra,1)!=0)goto finish;}if(!ax_fixture_authorization_decode(frame,44+payload,&auth))goto finish;memset(frame,0,sizeof frame);
 if(!open_connections())goto finish;for(size_t i=0;i<auth.count;i++){if(!scenario(&auth,i))goto finish;unsigned char result[12]={0};memcpy(result,AX_FIXTURE_RESULT,8);result[8]=(unsigned char)i;result[9]=1;if(!io(4,result,sizeof result,1))goto finish;}
 {unsigned char done[12]={0};memcpy(done,AX_FIXTURE_DONE,8);done[8]=(unsigned char)auth.count;done[9]=1;if(!io(4,done,sizeof done,1))goto finish;}ok=1;
 finish:if(run.request)xpc_connection_cancel(run.request);if(run.origin)xpc_connection_cancel(run.origin);if(run.queue)dispatch_sync(run.queue,^{stop();ax_system_peer_revoke(&run.self);ax_system_peer_revoke(&run.broker);});memset(hello,0,sizeof hello);memset(echo,0,sizeof echo);memset(frame,0,sizeof frame);ax_fixture_authorization_wipe(&auth);close(3);close(4);return ok?0:74;
}}
