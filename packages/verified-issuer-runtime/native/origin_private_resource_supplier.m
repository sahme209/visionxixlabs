#include "origin_private_resource_supplier.h"
#include "origin_owner_binding.h"
#include "synthetic_fixture_readiness.h"
#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <LocalAuthentication/LocalAuthentication.h>
#include <stdatomic.h>
#include <string.h>
#include <time.h>
#include "synthetic_resource_contract.h"
#include "cssm_policy_prepared.h"
#include "cssm_policy_inspect.h"
#include <sys/stat.h>
#include <sys/acl.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
static int load_references(void);
static int installation_context(void);
extern OSStatus SecKeychainSetUserInteractionAllowed(Boolean) __attribute__((weak_import));
static atomic_int startup_state;
int axiom_private_supplier_operational(void){
 return ax_fixture_supplier_context_current();
}

int axiom_private_supplier_startup(void){
 int expected=0;if(!atomic_compare_exchange_strong(&startup_state,&expected,-1))return 0;
 #pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
 if(!axiom_private_supplier_operational()||!axiom_owner_binding_current()||!SecKeychainSetUserInteractionAllowed)return 0;
 OSStatus result=SecKeychainSetUserInteractionAllowed(false);
#pragma clang diagnostic pop
 if(result!=errSecSuccess||!load_references())return 0;atomic_store(&startup_state,1);return 1;
}
static int compatible_datasource(const UInt8*bytes,size_t n){
 for(size_t i=0;i<n;i++)if(bytes[i]<=0x20||bytes[i]==0x7f)return 0;
 NSString*text=[[NSString alloc] initWithBytes:bytes length:n encoding:NSUTF8StringEncoding];if(!text)return 0;
 NSURLComponents*parts=[NSURLComponents componentsWithString:text];return parts&&([parts.scheme isEqualToString:@"postgresql"]||[parts.scheme isEqualToString:@"postgres"])&&parts.host.length>0&&parts.path.length>1&&parts.fragment==nil;
}
static int current(const atomic_int*cancelled,uint64_t deadline){struct timespec t;if(!cancelled||atomic_load(cancelled)||clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return 0;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec<deadline;}
/* Exact retained references only. Startup remains permanently unavailable until
 * independently qualified installed/principal/pre-main policy exists. */
static int ax_synthetic_inspect_item(SecKeychainItemRef item,SecKeychainRef expected,unsigned role){
 if(!item||!expected||role<1||role>3||!installation_context()||CFGetTypeID(item)!=SecKeychainItemGetTypeID())return 0;
 SecKeychainRef containing=NULL;SecAccessRef access=NULL;int ok=0;
 if(SecKeychainItemCopyKeychain(item,&containing)!=errSecSuccess||!containing||!CFEqual(containing,expected))goto done;
 UInt32 tags[]={kSecServiceItemAttr,kSecAccountItemAttr},formats[]={CSSM_DB_ATTRIBUTE_FORMAT_BLOB,CSSM_DB_ATTRIBUTE_FORMAT_BLOB};
 SecKeychainAttributeInfo info={2,tags,formats};SecKeychainAttributeList *attrs=NULL;SecItemClass cls=0;
 if(!installation_context()||SecKeychainItemCopyAttributesAndData(item,&info,&cls,&attrs,NULL,NULL)!=errSecSuccess)goto done;
 const char*values[]={AX_SYNTH_SERVICE,ax_synthetic_account(role)};ok=cls==kSecGenericPasswordItemClass&&attrs&&attrs->count==2&&attrs->attr;
 for(unsigned i=0;ok&&i<2;i++)ok=attrs->attr[i].tag==tags[i]&&attrs->attr[i].length==strlen(values[i])&&attrs->attr[i].data&&!memcmp(attrs->attr[i].data,values[i],attrs->attr[i].length);
 SecKeychainItemFreeAttributesAndData(attrs,NULL);if(!ok)goto done;ok=0;
 if(!installation_context()||SecKeychainItemCopyAccess(item,&access)!=errSecSuccess||!access)goto done;
 uid_t uid=1;gid_t gid=1;SecAccessOwnerType owner_type=0;CFArrayRef acl_list=NULL;
 if(!installation_context()||SecAccessCopyOwnerAndACL(access,&uid,&gid,&owner_type,&acl_list)!=errSecSuccess)goto done;
 int owner_ok=uid==0&&gid==0&&owner_type==kSecUseOnlyUID;if(acl_list)CFRelease(acl_list);if(!owner_ok)goto done;
 CSSM_ACL_OWNER_PROTOTYPE *owner=NULL;CSSM_ACL_ENTRY_INFO *entries=NULL;uint32 count=0;
 if(!installation_context()||SecAccessGetOwnerAndACL(access,&owner,&count,&entries)!=errSecSuccess)goto done;
 const ax_cssm_policy*policy=ax_cssm_prepared_policy();
 ok=policy&&ax_cssm_inspect_framework(policy,owner,count,entries);
 /* Export allocation/lifetime behavior remains an operational qualification
  * gap; no allocation bound is inferred from three retained item references. */
 done:if(access)CFRelease(access);if(containing)CFRelease(containing);return ok&&installation_context();
}
static SecKeychainRef selected_keychain;
static SecKeychainItemRef retained_items[3];
static int installation_context(void){
 /* Current owned origin and protected installed coordinates; item policy is
  * checked separately around every retained reference access. */
 return axiom_private_supplier_operational()&&axiom_owner_binding_current();
}
static int safe_stat(int fd,int directory,mode_t mode){
 struct stat s;if(fstat(fd,&s)||s.st_uid||(!directory&&s.st_gid)||!((directory?S_ISDIR(s.st_mode):S_ISREG(s.st_mode)))||(s.st_mode&0777)!=mode||(!directory&&s.st_nlink!=1))return 0;
 acl_t a=acl_get_fd_np(fd,ACL_TYPE_EXTENDED);if(!a)return 0;acl_entry_t e;int n=acl_get_entry(a,ACL_FIRST_ENTRY,&e);acl_free(a);return n==0;
}
static int protected_directory(void){
 int fd=open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return -1;
 char path[]=AX_SYNTH_ROOT;char *save=NULL,*part=strtok_r(path,"/",&save);
 while(part){int next=openat(fd,part,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);close(fd);fd=next;if(fd<0||!safe_stat(fd,1,0755)){if(fd>=0)close(fd);return -1;}part=strtok_r(NULL,"/",&save);}return fd;
}
/* Internal fixed-startup selector step. This accepts owned bounded locators,
 * never policy/installation authority; caller must independently gate context. */
static SecKeychainItemRef resolve_reference(CFDataRef locator,SecKeychainRef keychain,unsigned role){
 if(!installation_context()||!locator||CFGetTypeID(locator)!=CFDataGetTypeID()||CFDataGetLength(locator)<1||CFDataGetLength(locator)>AX_SYNTH_LOCATOR_MAX||!keychain||role<1||role>3)return NULL;
 NSDictionary*q=@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,(__bridge id)kSecMatchItemList:@[(__bridge id)locator],(__bridge id)kSecMatchSearchList:@[(__bridge id)keychain],(__bridge id)kSecMatchLimit:(__bridge id)kSecMatchLimitOne,(__bridge id)kSecReturnRef:@YES};
 CFTypeRef value=NULL;OSStatus status=SecItemCopyMatching((__bridge CFDictionaryRef)q,&value);
 if(status!=errSecSuccess||!installation_context()||!value||CFGetTypeID(value)!=SecKeychainItemGetTypeID()||!ax_synthetic_inspect_item((SecKeychainItemRef)value,keychain,role)){if(value)CFRelease(value);return NULL;}
 return (SecKeychainItemRef)value;
}
static int load_references(void){
 if(!installation_context())return 0;
 unsigned char record[AX_SYNTH_RECORD_MAX+1];AxSyntheticLocators locators;int directory=protected_directory();if(directory<0)return 0;int fd=openat(directory,"bootstrap-locators.v1",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);close(directory);if(fd<0)return 0;
 struct stat st;int ok=safe_stat(fd,0,0644)&&!fstat(fd,&st)&&st.st_size>0&&st.st_size<=AX_SYNTH_RECORD_MAX;
 size_t used=0;while(ok&&used<sizeof record){ssize_t n=read(fd,record+used,sizeof record-used);if(n<0&&errno==EINTR)continue;if(n<0){ok=0;break;}if(!n)break;used+=(size_t)n;}
 if(close(fd))ok=0;if(!ok||used>AX_SYNTH_RECORD_MAX||!ax_synthetic_locator_decode(record,used,&locators))return 0;
 if(!installation_context()||!ax_cssm_prepare_once())return 0;
 if(SecKeychainOpen(AX_SYNTH_KEYCHAIN_PATH,&selected_keychain)!=errSecSuccess||!selected_keychain)goto refused;
 for(unsigned i=0;i<3;i++){
  CFDataRef locator=CFDataCreate(NULL,locators.bytes[i],(CFIndex)locators.length[i]);if(!locator)goto refused;
  retained_items[i]=resolve_reference(locator,selected_keychain,i+1);CFRelease(locator);
  if(!retained_items[i]||!installation_context())goto refused;
 }if(installation_context())return 1;
 refused:for(unsigned i=0;i<3;i++)if(retained_items[i]){CFRelease(retained_items[i]);retained_items[i]=NULL;}
 if(selected_keychain){CFRelease(selected_keychain);selected_keychain=NULL;}return 0;
}
static int reference_read(unsigned role,unsigned char*out,size_t min,size_t max,size_t*length,int utf8,const atomic_int*cancelled,uint64_t deadline){
 if(role<1||role>3||!current(cancelled,deadline)||!installation_context()||!ax_synthetic_inspect_item(retained_items[role-1],selected_keychain,role))return 0;
 UInt32 n=0;void*data=NULL;SecItemClass cls=0;
 OSStatus status=SecKeychainItemCopyContent(retained_items[role-1],&cls,NULL,&n,&data);int ok=status==errSecSuccess&&cls==kSecGenericPasswordItemClass&&data&&n>=min&&n<=max;
 ok=ok&&current(cancelled,deadline)&&installation_context()&&ax_synthetic_inspect_item(retained_items[role-1],selected_keychain,role);
 if(ok&&(!utf8||compatible_datasource(data,n))){memcpy(out,data,n);*length=n;}else ok=0;
 if(data){volatile unsigned char*p=data;for(UInt32 i=0;i<n;i++)p[i]=0;SecKeychainItemFreeContent(NULL,data);}return ok;
}
int axiom_private_supplier_read(AxiomPrivateMaterial*m,const atomic_int*cancelled,uint64_t deadline){
 if(!m)return 0;axiom_private_material_wipe(m);
 if(atomic_load(&startup_state)!=1)return 0;
 if(!installation_context()||!current(cancelled,deadline)){atomic_store(&startup_state,-1);return 0;}
 @autoreleasepool{size_t vault_length=0;
  if(reference_read(1,m->datasource,1,8192,&m->datasource_length,1,cancelled,deadline)&&reference_read(2,m->vault,32,32,&vault_length,0,cancelled,deadline)&&reference_read(3,m->session,32,4096,&m->session_length,0,cancelled,deadline)&&current(cancelled,deadline)&&installation_context())return 1;
 }
 atomic_store(&startup_state,-1);axiom_private_material_wipe(m);return 0;
}
