#include "origin_private_resource_supplier.h"
#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <LocalAuthentication/LocalAuthentication.h>
#include <stdatomic.h>
#include <string.h>
#include <time.h>
extern OSStatus SecKeychainSetUserInteractionAllowed(Boolean) __attribute__((weak_import));
static atomic_int startup_state;
int axiom_private_supplier_operational(void){
 /* No provisioned/qualified installation exists in this preparation profile.
  * Changing this gate requires separately authorized installation evidence. */
 return 0;
}
int axiom_private_supplier_startup(void){
 int expected=0;if(!atomic_compare_exchange_strong(&startup_state,&expected,-1))return 0;
 #pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
 if(!axiom_private_supplier_operational()||!SecKeychainSetUserInteractionAllowed)return 0;
 OSStatus result=SecKeychainSetUserInteractionAllowed(false);
#pragma clang diagnostic pop
 if(result!=errSecSuccess)return 0;atomic_store(&startup_state,1);return 1;
}
static int compatible_datasource(const UInt8*bytes,size_t n){
 for(size_t i=0;i<n;i++)if(bytes[i]<=0x20||bytes[i]==0x7f)return 0;
 NSString*text=[[NSString alloc] initWithBytes:bytes length:n encoding:NSUTF8StringEncoding];if(!text)return 0;
 NSURLComponents*parts=[NSURLComponents componentsWithString:text];return parts&&([parts.scheme isEqualToString:@"postgresql"]||[parts.scheme isEqualToString:@"postgres"])&&parts.host.length>0&&parts.path.length>1&&parts.fragment==nil;
}
static int fetch(NSString*account,unsigned char*out,size_t minimum,size_t maximum,size_t*length,int utf8){
 NSDictionary*query=@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,(__bridge id)kSecAttrService:@"com.visionxixlabs.axiom.issuer.bootstrap",(__bridge id)kSecAttrAccount:account,(__bridge id)kSecMatchLimit:(__bridge id)kSecMatchLimitOne,(__bridge id)kSecReturnData:@YES};
 CFTypeRef value=NULL;OSStatus status=SecItemCopyMatching((__bridge CFDictionaryRef)query,&value);int ok=0;
 if(status==errSecSuccess&&value&&CFGetTypeID(value)==CFDataGetTypeID()){
  CFIndex n=CFDataGetLength((CFDataRef)value);if(n>0&&(size_t)n>=minimum&&(size_t)n<=maximum){const UInt8*bytes=CFDataGetBytePtr((CFDataRef)value);
   if(bytes&&(!utf8||compatible_datasource(bytes,(size_t)n))){memcpy(out,bytes,(size_t)n);*length=(size_t)n;ok=1;}
  }
 }
 if(value)CFRelease(value);return ok;
}
static int current(const atomic_int*cancelled,uint64_t deadline){struct timespec t;if(!cancelled||atomic_load(cancelled)||clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return 0;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec<deadline;}
int axiom_private_supplier_read(AxiomPrivateMaterial*m,const atomic_int*cancelled,uint64_t deadline){
 if(!m)return 0;axiom_private_material_wipe(m);
 if(atomic_load(&startup_state)!=1||!axiom_private_supplier_operational()||!current(cancelled,deadline))return 0;
 @autoreleasepool{size_t vault_length=0;
  if(current(cancelled,deadline)&&fetch(@"authority-postgres",m->datasource,1,8192,&m->datasource_length,1)&&current(cancelled,deadline)&&fetch(@"vault-key",m->vault,32,32,&vault_length,0)&&current(cancelled,deadline)&&fetch(@"desktop-session-key",m->session,32,4096,&m->session_length,0)&&current(cancelled,deadline))return 1;
 }
 axiom_private_material_wipe(m);return 0;
}
