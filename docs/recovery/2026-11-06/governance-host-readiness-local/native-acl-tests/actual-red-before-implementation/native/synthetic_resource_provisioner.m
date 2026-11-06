/* COMPILE/LINK ONLY. Uninstalled, unlinked maintenance adapter. Never run during
 * preparation. No operational qualification or runtime activation is provided. */
#include "synthetic_resource_provisioner.h"
#include "synthetic_fixture_producer.h"
#include "synthetic_fixture_readiness.h"
#include "cssm_policy_inspect.h"
#import <Foundation/Foundation.h>
#include <sys/stat.h>
#include <sys/acl.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <string.h>
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
static AxSyntheticProvisionOnce native_once={ATOMIC_FLAG_INIT};
typedef struct {const unsigned char *bytes[3];size_t length[3];} AxSyntheticInstallerMaterial;
typedef struct {int dir,journal;SecKeychainRef keychain;SecAccessRef access;const AxSyntheticInstallerMaterial *material;} Native;
/* Walk absolute fixed path without following any component. Restrict all write
 * paths to root; extended ACLs refuse rather than infer absence of write grants. */
static int safe_stat(int fd,int directory,mode_t mode){
 struct stat s;if(fstat(fd,&s)||s.st_uid||(!directory&&s.st_gid)||!((directory?S_ISDIR(s.st_mode):S_ISREG(s.st_mode)))||(s.st_mode&0777)!=mode||(!directory&&s.st_nlink!=1))return 0;
 acl_t a=acl_get_fd_np(fd,ACL_TYPE_EXTENDED);if(!a)return 0;acl_entry_t e;int n=acl_get_entry(a,ACL_FIRST_ENTRY,&e);acl_free(a);return n==0;
}
static int protected_directory(void){
 int fd=open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return -1;
 char path[]=AX_SYNTH_ROOT;char *save=NULL,*part=strtok_r(path,"/",&save);
 while(part){int next=openat(fd,part,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);close(fd);fd=next;if(fd<0||!safe_stat(fd,1,0755)){if(fd>=0)close(fd);return -1;}part=strtok_r(NULL,"/",&save);}return fd;
}
/* No fsync-only fallback: actual platform persistence qualification remains separate. */
static int sync_fd(int fd){return fcntl(fd,F_FULLFSYNC,0)==0;}
static int write_all(int fd,const unsigned char *p,size_t n){while(n){ssize_t w=write(fd,p,n);if(w<0&&errno==EINTR)continue;if(w<=0)return 0;p+=w;n-=(size_t)w;}return 1;}
static int journal_write(void *v,const unsigned char record[32]){Native*n=v;return write_all(n->journal,record,32)&&sync_fd(n->journal)&&sync_fd(n->dir);}
static int publish(void *v,const AxSyntheticLocators *locators){
 Native*n=v;unsigned char buffer[AX_SYNTH_RECORD_MAX];size_t length=0;if(!ax_synthetic_locator_encode(locators,buffer,&length))return AX_SYNTH_PUBLISH_IO;
 int fd=openat(n->dir,"bootstrap-locators.v1.staging",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(fd<0)return errno==EEXIST?AX_SYNTH_PUBLISH_COLLISION:AX_SYNTH_PUBLISH_IO;
 int ok=fchown(fd,0,0)==0&&fchmod(fd,0644)==0&&safe_stat(fd,0,0644)&&write_all(fd,buffer,length)&&sync_fd(fd);
 if(close(fd))ok=0;
 if(!ok)return AX_SYNTH_PUBLISH_UNKNOWN;
 /* macOS SDK declares RENAME_EXCL: no replace, no unsafe rename fallback. */
 if(renameatx_np(n->dir,"bootstrap-locators.v1.staging",n->dir,"bootstrap-locators.v1",RENAME_EXCL)){if(errno==EEXIST)return AX_SYNTH_PUBLISH_COLLISION;if(errno==ENOTSUP||errno==EINVAL)return AX_SYNTH_PUBLISH_UNSUPPORTED;return AX_SYNTH_PUBLISH_UNKNOWN;}
 return sync_fd(n->dir)&&ax_fixture_authorization_locators_published()?AX_SYNTH_PUBLISH_OK:AX_SYNTH_PUBLISH_UNKNOWN;
}
static int add(void *v,unsigned role,unsigned char locator[AX_SYNTH_LOCATOR_MAX],size_t *length){
 Native*n=v;if(role<1||role>3)return AX_SYNTH_ADD_FAILED;
 NSDictionary*q=@{(__bridge id)kSecClass:(__bridge id)kSecClassGenericPassword,(__bridge id)kSecAttrService:@AX_SYNTH_SERVICE,(__bridge id)kSecAttrAccount:[NSString stringWithUTF8String:ax_synthetic_account(role)],(__bridge id)kSecUseKeychain:(__bridge id)n->keychain,(__bridge id)kSecAttrAccess:(__bridge id)n->access,(__bridge id)kSecValueData:[NSData dataWithBytes:n->material->bytes[role-1] length:n->material->length[role-1]],(__bridge id)kSecReturnPersistentRef:@YES};
 CFTypeRef result=NULL;OSStatus status=SecItemAdd((__bridge CFDictionaryRef)q,&result);int outcome=AX_SYNTH_ADD_UNKNOWN;
 if(status==errSecDuplicateItem)outcome=AX_SYNTH_ADD_DUPLICATE;
 else if(status!=errSecSuccess)outcome=AX_SYNTH_ADD_FAILED;
 else if(result&&CFGetTypeID(result)==CFDataGetTypeID()){
  CFIndex z=CFDataGetLength((CFDataRef)result);*length=z>0?(size_t)z:0;
  if(z>0&&z<=AX_SYNTH_LOCATOR_MAX){memcpy(locator,CFDataGetBytePtr((CFDataRef)result),(size_t)z);outcome=AX_SYNTH_ADD_OK;}else {*length=0;outcome=AX_SYNTH_ADD_OK;}
 }else {*length=0;outcome=AX_SYNTH_ADD_OK;}
 if(result)CFRelease(result);return outcome;
}
static int valid_material(const AxSyntheticInstallerMaterial*m){
 if(!m||!m->bytes[0]||!m->bytes[1]||!m->bytes[2]||m->length[0]<1||m->length[0]>8192||m->length[1]!=32||m->length[2]<32||m->length[2]>4096)return 0;
 NSString*s=[[NSString alloc]initWithBytes:m->bytes[0] length:m->length[0] encoding:NSUTF8StringEncoding];
 NSURLComponents*p=s?[NSURLComponents componentsWithString:s]:nil;
 if(!p||!([p.scheme isEqualToString:@"postgres"]||[p.scheme isEqualToString:@"postgresql"])||!p.host.length||p.path.length<2||p.fragment)return 0;
 for(size_t i=0;i<m->length[0];i++)if(m->bytes[0][i]<=0x20||m->bytes[0][i]==0x7f)return 0;return 1;
}
AxSyntheticProvisionResult ax_synthetic_native_provision(void){
 AxiomPrivateMaterial owned;memset(&owned,0,sizeof owned);
 AxSyntheticInstallerMaterial fixed={{owned.datasource,owned.vault,owned.session},{0,32,32}};
 const AxSyntheticInstallerMaterial*m=&fixed;
 AxSyntheticProvisionResult refused={10,AX_SYNTH_UNSUPPORTED,0,0};
 /* Trusted operator only; no runtime caller can acquire this maintenance module. */
 static atomic_flag entered=ATOMIC_FLAG_INIT;if(atomic_flag_test_and_set(&entered))return refused;
 if(!ax_fixture_maintenance_current()||!ax_fixture_prepare_once(&owned))return refused;
 fixed.length[0]=owned.datasource_length;fixed.length[2]=owned.session_length;
 if(!valid_material(m)){volatile unsigned char*p=(volatile unsigned char*)&owned;for(size_t i=0;i<sizeof owned;i++)p[i]=0;return refused;}
 Native n={.dir=-1,.journal=-1,.material=m};
 @autoreleasepool{
 n.dir=protected_directory();if(n.dir<0)goto finish;
 if(SecKeychainSetUserInteractionAllowed(false)!=errSecSuccess||!ax_cssm_prepare_once()||!(n.access=ax_cssm_prepared_access()))goto finish;
 CSSM_ACL_OWNER_PROTOTYPE*owner=NULL;CSSM_ACL_ENTRY_INFO*entries=NULL;uint32 count=0;
 if(SecAccessGetOwnerAndACL(n.access,&owner,&count,&entries)!=errSecSuccess||!ax_cssm_prepared_policy()||!ax_cssm_inspect_framework(ax_cssm_prepared_policy(),owner,count,entries))goto finish;
 if(SecKeychainOpen(AX_SYNTH_KEYCHAIN_PATH,&n.keychain)!=errSecSuccess||!n.keychain)goto finish;
 n.journal=openat(n.dir,"bootstrap-transaction.v1",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
 if(n.journal<0||fchown(n.journal,0,0)||fchmod(n.journal,0600)||!safe_stat(n.journal,0,0600)||!sync_fd(n.journal)||!sync_fd(n.dir))goto finish;
 AxSyntheticProvisionOps ops={&n,journal_write,add,publish};refused=ax_synthetic_provision_once(&native_once,&ops);
 finish:if(n.journal>=0)close(n.journal);if(n.dir>=0)close(n.dir);if(n.keychain)CFRelease(n.keychain);
 }volatile unsigned char*w=(volatile unsigned char*)&owned;for(size_t i=0;i<sizeof owned;i++)w[i]=0;return refused;
}
