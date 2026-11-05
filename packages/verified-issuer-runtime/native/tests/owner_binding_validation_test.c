/* Test includes the actual private translation unit. Every reached platform
 * dependency below is inert; no Security/XPC/clock/process API is called. */
#include <assert.h>
#include <stdio.h>
#define ax_system_peer_current fake_system_peer_current
#define ax_system_peer_prepare fake_system_peer_prepare
#define ax_system_peer_requirement fake_system_peer_requirement
#define ax_system_peer_revoke fake_system_peer_revoke
#include "../origin_owner_binding.c"
static int fake_peer_current=1,fake_peer_change=0;
int fake_system_peer_current(AxSystemPeer*p){(void)p;return fake_peer_current;}
int fake_system_peer_prepare(AxSystemPeer*p,int role){(void)p;return role==AX_SYSTEM_PEER_OWNER&&fake_peer_current;}
const char*fake_system_peer_requirement(AxSystemPeer*p){(void)p;return fake_peer_current?"cdhash H\"0102030405060708090a0b0c0d0e0f1011121314\"":NULL;}
void fake_system_peer_revoke(AxSystemPeer*p){(void)p;fake_peer_current=0;}
static uint64_t fake_now=1;static int fake_auth=1,fake_delay=0;static size_t fake_count=6,ng=16,nc=32,nb=32;
static int fake_childtype=1,fake_seqtype=1;static int64_t fake_child=37;static uint64_t fake_seq;
static const char*fake_status="owner_pending";static unsigned char gen[16]={1},challenge[32]={2},owner_nonce[32]={3};
static unsigned char child_value,seq_value,reply_value;
pid_t getpid(void){return 37;}
int clock_gettime(clockid_t clock,struct timespec*t){(void)clock;t->tv_sec=0;t->tv_nsec=(long)fake_now;return 0;}
xpc_type_t xpc_get_type(xpc_object_t v){if(v==(xpc_object_t)&child_value)return fake_childtype?XPC_TYPE_INT64:XPC_TYPE_UINT64;if(v==(xpc_object_t)&seq_value)return fake_seqtype?XPC_TYPE_UINT64:XPC_TYPE_INT64;return XPC_TYPE_DICTIONARY;}
size_t xpc_dictionary_get_count(xpc_object_t v){(void)v;return fake_count;}
const char*xpc_dictionary_get_string(xpc_object_t v,const char*k){(void)v;return !strcmp(k,"status")?fake_status:NULL;}
xpc_object_t xpc_dictionary_get_value(xpc_object_t v,const char*k){(void)v;if(!strcmp(k,"child"))return(xpc_object_t)&child_value;if(!strcmp(k,"sequence"))return(xpc_object_t)&seq_value;return NULL;}
int64_t xpc_dictionary_get_int64(xpc_object_t v,const char*k){(void)v;(void)k;return fake_child;}
uint64_t xpc_dictionary_get_uint64(xpc_object_t v,const char*k){(void)v;(void)k;return fake_seq;}
const void*xpc_dictionary_get_data(xpc_object_t v,const char*k,size_t*n){(void)v;if(!strcmp(k,"generation")){*n=ng;return gen;}if(!strcmp(k,"client")){*n=nc;return challenge;}if(!strcmp(k,"owner")){*n=nb;return owner_nonce;}return NULL;}
void xpc_connection_cancel(xpc_connection_t c){(void)c;assert(!"unexpected platform cancellation");}
CFStringRef CFStringCreateWithCString(CFAllocatorRef a,const char*s,CFStringEncoding e){(void)a;(void)s;(void)e;return(CFStringRef)(uintptr_t)1;}
void CFRelease(CFTypeRef x){(void)x;}
OSStatus SecRequirementCreateWithString(CFStringRef s,SecCSFlags f,SecRequirementRef*r){(void)s;(void)f;*r=(SecRequirementRef)(uintptr_t)1;return errSecSuccess;}
OSStatus SecCodeCreateWithXPCMessage(xpc_object_t x,SecCSFlags f,SecCodeRef*r){(void)x;(void)f;*r=(SecCodeRef)(uintptr_t)1;return errSecSuccess;}
OSStatus SecCodeCheckValidity(SecCodeRef r,SecCSFlags f,SecRequirementRef q){(void)r;(void)f;(void)q;if(fake_delay)fake_now=100;if(fake_peer_change)fake_peer_current=0;return fake_auth?errSecSuccess:errSecCSUnsigned;}
static void reset(void){fake_peer_current=1;fake_peer_change=0;memset(&client,0,sizeof(client));atomic_store(&revoked,0);fake_now=1;fake_auth=1;fake_delay=0;fake_count=6;ng=16;nc=32;nb=32;fake_childtype=fake_seqtype=1;fake_child=37;fake_seq=0;fake_status="owner_pending";memset(gen,0,16);gen[0]=1;memset(challenge,0,32);challenge[0]=2;memset(owner_nonce,0,32);owner_nonce[0]=3;response_deadline=100;assert(ax_owner_client_prepare(&client,37,gen,challenge));}
int main(void){xpc_object_t r=(xpc_object_t)&reply_value;
 reset();assert(validate(r,"owner_pending",0));assert(client.phase==AX_OWNER_PENDING);fake_status="owner_authenticated";assert(validate(r,"owner_authenticated",1));assert(client.phase==AX_OWNER_AUTHENTICATED);uint64_t seq;assert(ax_owner_client_next(&client,&seq));fake_seq=seq;fake_status="owner_current";assert(validate(r,"owner_current",2));assert(client.sequence==1);
 reset();fake_child=38;assert(!validate(r,"owner_pending",0));
 reset();fake_childtype=0;assert(!validate(r,"owner_pending",0));
 reset();fake_seqtype=0;assert(!validate(r,"owner_pending",0));
 reset();fake_count=7;assert(!validate(r,"owner_pending",0));
 reset();ng=15;assert(!validate(r,"owner_pending",0));
 reset();nc=31;assert(!validate(r,"owner_pending",0));
 reset();nb=31;assert(!validate(r,"owner_pending",0));
 reset();gen[0]=9;assert(!validate(r,"owner_pending",0));
 reset();challenge[0]=9;assert(!validate(r,"owner_pending",0));
 reset();fake_status="owner_current";assert(!validate(r,"owner_pending",0));
 reset();fake_seq=1;assert(!validate(r,"owner_pending",0));
 reset();fake_auth=0;assert(!validate(r,"owner_pending",0));
 reset();fake_delay=1;assert(!validate(r,"owner_pending",0));
 reset();fake_now=100;assert(!validate(r,"owner_pending",0));
 reset();atomic_store(&revoked,1);assert(!validate(r,"owner_pending",0));
 reset();fake_peer_current=0;assert(!validate(r,"owner_pending",0));
 reset();fake_peer_change=1;assert(!validate(r,"owner_pending",0));
 puts("actual native owner response validator: 18 cases passed with inert platform mocks");return 0;
}
