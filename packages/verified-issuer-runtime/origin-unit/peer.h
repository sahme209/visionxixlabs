#ifndef AXIOM_ORIGIN_PEER_H
#define AXIOM_ORIGIN_PEER_H
#include <xpc/xpc.h>
#include <Security/Security.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
static int origin_message_matches(xpc_object_t message,const char *requirement){
 if(!SecCodeCreateWithXPCMessage||!message||xpc_get_type(message)!=XPC_TYPE_DICTIONARY)return 0;
 SecCodeRef code=NULL;SecRequirementRef req=NULL;CFStringRef text=CFStringCreateWithCString(NULL,requirement,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus r=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&req);CFRelease(text);
 if(r!=errSecSuccess||!req)return 0;
 r=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);
 int ok=r==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,req)==errSecSuccess;
 if(code)CFRelease(code);CFRelease(req);return ok;
}
#endif
