/* The actual helper translation unit is included with every filesystem/ACL/
 * Security call redirected to inert functions. No protected path is touched. */
#define open fake_open
#define openat fake_openat
#define close fake_close
#define fstat fake_fstat
#define pread fake_pread
#define acl_get_fd_np fake_acl_get_fd_np
#define acl_init fake_acl_init
#define acl_size fake_acl_size
#define acl_copy_ext fake_acl_copy_ext
#define acl_free fake_acl_free
#define CFURLCreateFromFileSystemRepresentation fake_CFURLCreateFromFileSystemRepresentation
#define CFStringCreateWithCString fake_CFStringCreateWithCString
#define CFRelease fake_CFRelease
#define CFGetTypeID fake_CFGetTypeID
#define CFDictionaryGetValue fake_CFDictionaryGetValue
#define CFDictionaryGetTypeID fake_CFDictionaryGetTypeID
#define CFDictionaryGetCount fake_CFDictionaryGetCount
#define CFNumberGetTypeID fake_CFNumberGetTypeID
#define CFNumberGetValue fake_CFNumberGetValue
#define CFDataGetTypeID fake_CFDataGetTypeID
#define CFDataGetLength fake_CFDataGetLength
#define CFDataGetBytePtr fake_CFDataGetBytePtr
#define CFStringGetTypeID fake_CFStringGetTypeID
#define CFStringGetCString fake_CFStringGetCString
#define SecStaticCodeCreateWithPath fake_SecStaticCodeCreateWithPath
#define SecStaticCodeCheckValidity fake_SecStaticCodeCheckValidity
#define SecCodeCopySigningInformation fake_SecCodeCopySigningInformation
#define SecRequirementCreateWithString fake_SecRequirementCreateWithString
#include <assert.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <mach-o/fat.h>
#include "../system_peer_binding.c"

static int fake_directory_gid;static int fake_wrong_id,fake_wrong_team,fake_hash_type=20;static int fake_role=AX_SYSTEM_PEER_OWNER,fake_uid=0,fake_gid=0,fake_acl=0,fake_link=1,fake_mode=0755,fake_arch=0,fake_valid=1,fake_mutate=0,fake_failopen=0,fake_changed_inode=0,fake_digest=2,fake_hashlength=20,fake_flags=kSecCodeSignatureRuntime,fake_ent=0,fake_raw=0,fake_wrote=0,fake_mutated=0;
static unsigned char image[128],hashbytes[20];static int close_calls;static int nextdir=10;static char checked_path[PATH_MAX];
typedef struct {int type;int number;const char*string;const unsigned char*bytes;size_t length;} FakeValue;
static FakeValue number_value={10,0,NULL,NULL,0},string_value={40,0,NULL,NULL,0},data_value={20,0,NULL,NULL,0},dict_value={30,0,NULL,NULL,0},info_value={30,0,NULL,NULL,0};
const CFStringRef kSecCodeInfoFlags=(CFStringRef)(uintptr_t)1,kSecCodeInfoDigestAlgorithm=(CFStringRef)(uintptr_t)2,kSecCodeInfoIdentifier=(CFStringRef)(uintptr_t)3,kSecCodeInfoTeamIdentifier=(CFStringRef)(uintptr_t)4,kSecCodeInfoEntitlementsDict=(CFStringRef)(uintptr_t)5,kSecCodeInfoEntitlements=(CFStringRef)(uintptr_t)6,kSecCodeInfoUnique=(CFStringRef)(uintptr_t)7;
int fake_open(const char*path,int flags,...){assert(!strcmp(path,"/"));assert(flags&O_NOFOLLOW);return fake_failopen?-1:nextdir++;}
int fake_openat(int dir,const char*path,int flags,...){(void)dir;assert(path&&strchr(path,'/')==NULL);assert(flags&O_NOFOLLOW);if(fake_failopen)return-1;if(!(flags&O_DIRECTORY))return 100;return nextdir++;}
int fake_close(int fd){assert(fd>=0);close_calls++;return 0;}
int fake_fstat(int fd,struct stat*s){memset(s,0,sizeof(*s));s->st_uid=(uid_t)fake_uid;s->st_gid=(gid_t)(fd==100?fake_gid:fake_directory_gid);s->st_mode=(mode_t)((fd==100?S_IFREG:S_IFDIR)|fake_mode);s->st_nlink=(nlink_t)(fd==100?fake_link:1);s->st_size=fd==100?(off_t)sizeof(image):0;s->st_dev=1;s->st_ino=(ino_t)(fd==100?100+fake_changed_inode:fd);s->st_mtimespec.tv_sec=1;s->st_ctimespec.tv_sec=2;return 0;}
ssize_t fake_pread(int fd,void*out,size_t n,off_t offset){assert(fd==100);if((size_t)offset>=sizeof image)return 0;if(n>sizeof image-(size_t)offset)n=sizeof image-(size_t)offset;memcpy(out,image+offset,n);return(ssize_t)n;}
acl_t fake_acl_get_fd_np(int fd,acl_type_t type){(void)fd;assert(type==ACL_TYPE_EXTENDED);return(acl_t)(uintptr_t)1;}
acl_t fake_acl_init(int n){assert(n==0);return (acl_t)(uintptr_t)2;}
ssize_t fake_acl_size(acl_t a){assert((uintptr_t)a==1||(uintptr_t)a==2);return 8;}
ssize_t fake_acl_copy_ext(void*p,acl_t a,ssize_t n){assert(((uintptr_t)a==1||(uintptr_t)a==2)&&n==8);if(fake_acl<0)return -1;memset(p,fake_acl&&(uintptr_t)a==1?1:0,8);return 8;}
int fake_acl_free(void*p){assert((uintptr_t)p==1||(uintptr_t)p==2);return 0;}
CFURLRef fake_CFURLCreateFromFileSystemRepresentation(CFAllocatorRef a,const UInt8*path,CFIndex n,Boolean directory){(void)a;assert(!directory);assert(n>0&&(size_t)n<sizeof checked_path);memcpy(checked_path,path,(size_t)n);checked_path[n]=0;assert(!strcmp(checked_path,fake_role==AX_SYSTEM_PEER_OWNER?AX_OWNER_PATH:fake_role==AX_SYSTEM_PEER_BROKER?AX_SYNTH_BROKER:AX_SYNTH_APP "/Contents/MacOS/AxiomIssuerController"));return(CFURLRef)(uintptr_t)99;}
CFStringRef fake_CFStringCreateWithCString(CFAllocatorRef a,const char*s,CFStringEncoding enc){(void)a;(void)enc;assert(strstr(s,"anchor apple generic")&&strstr(s,"FG5N98FE6W"));assert(strstr(s,fake_role==AX_SYSTEM_PEER_OWNER?AX_SYSTEM_PEER_OWNER_ID:fake_role==AX_SYSTEM_PEER_BROKER?AX_SYSTEM_PEER_BROKER_ID:"com.visionxixlabs.axiom.synthetic.controller"));return(CFStringRef)(uintptr_t)98;}
void fake_CFRelease(CFTypeRef x){assert(x);}
CFTypeID fake_CFGetTypeID(CFTypeRef x){assert(x);return(CFTypeID)((const FakeValue*)x)->type;}
CFTypeID fake_CFDictionaryGetTypeID(void){return 30;}
CFTypeID fake_CFNumberGetTypeID(void){return 10;}
CFTypeID fake_CFDataGetTypeID(void){return 20;}
CFTypeID fake_CFStringGetTypeID(void){return 40;}
CFIndex fake_CFDictionaryGetCount(CFDictionaryRef d){assert(d==(CFDictionaryRef)&dict_value);return fake_ent==2?1:0;}
const void*fake_CFDictionaryGetValue(CFDictionaryRef d,const void*k){assert(d==(CFDictionaryRef)&info_value);uintptr_t key=(uintptr_t)k;switch(key){case 1:number_value.number=fake_flags;return&number_value;case 2:number_value.number=fake_digest;return&number_value;case 3:string_value.string=fake_wrong_id?"wrong-role":fake_role==AX_SYSTEM_PEER_OWNER?AX_SYSTEM_PEER_OWNER_ID:fake_role==AX_SYSTEM_PEER_BROKER?AX_SYSTEM_PEER_BROKER_ID:"com.visionxixlabs.axiom.synthetic.controller";return&string_value;case 4:string_value.string=fake_wrong_team?"WRONGTEAM":"FG5N98FE6W";return&string_value;case 5:return fake_ent?&dict_value:NULL;case 6:return fake_raw?&data_value:NULL;case 7:data_value.type=fake_hash_type;data_value.bytes=hashbytes;data_value.length=(size_t)fake_hashlength;return&data_value;default:return NULL;}}
Boolean fake_CFNumberGetValue(CFNumberRef n,CFNumberType type,void*out){(void)type;*(int*)out=((const FakeValue*)n)->number;return true;}
Boolean fake_CFStringGetCString(CFStringRef s,char*out,CFIndex n,CFStringEncoding enc){(void)enc;const char*v=((const FakeValue*)s)->string;if((CFIndex)strlen(v)>=n)return false;strcpy(out,v);return true;}
CFIndex fake_CFDataGetLength(CFDataRef d){return(CFIndex)((const FakeValue*)d)->length;}
const UInt8*fake_CFDataGetBytePtr(CFDataRef d){return((const FakeValue*)d)->bytes;}
OSStatus fake_SecRequirementCreateWithString(CFStringRef s,SecCSFlags flags,SecRequirementRef*out){assert(s);assert(flags==kSecCSDefaultFlags);*out=(SecRequirementRef)(uintptr_t)97;return errSecSuccess;}
OSStatus fake_SecStaticCodeCreateWithPath(CFURLRef u,SecCSFlags flags,SecStaticCodeRef*out){assert(u);assert(flags==kSecCSDefaultFlags);*out=(SecStaticCodeRef)(uintptr_t)96;return errSecSuccess;}
OSStatus fake_SecStaticCodeCheckValidity(SecStaticCodeRef c,SecCSFlags flags,SecRequirementRef r){assert(c&&r);assert(flags==(kSecCSStrictValidate|kSecCSCheckAllArchitectures));return fake_valid?errSecSuccess:errSecCSUnsigned;}
OSStatus fake_SecCodeCopySigningInformation(SecStaticCodeRef c,SecCSFlags flags,CFDictionaryRef*out){assert(c);assert(flags==kSecCSSigningInformation);if(fake_mutate){image[127]^=1;fake_mutated=1;}*out=(CFDictionaryRef)&info_value;return errSecSuccess;}
static void reset(void){fake_directory_gid=0;fake_wrong_id=fake_wrong_team=0;fake_hash_type=20;fake_role=AX_SYSTEM_PEER_OWNER;fake_uid=fake_gid=fake_acl=fake_arch=fake_mutate=fake_failopen=fake_changed_inode=fake_ent=fake_raw=fake_wrote=fake_mutated=0;fake_link=1;fake_mode=0755;fake_valid=1;fake_digest=2;fake_hashlength=20;fake_flags=kSecCodeSignatureRuntime;nextdir=10;memset(image,0,sizeof image);struct mach_header_64 h={0};h.magic=MH_MAGIC_64;h.cputype=CPU_TYPE_ARM64;h.cpusubtype=CPU_SUBTYPE_ARM64_ALL;h.filetype=MH_EXECUTE;h.ncmds=1;h.sizeofcmds=sizeof(struct load_command);memcpy(image,&h,sizeof h);for(unsigned i=0;i<20;i++)hashbytes[i]=(unsigned char)(i+1);}
static void refused(void){AxSystemPeer p={0};assert(!ax_system_peer_prepare(&p,fake_role));assert(p.revoked&&!p.captured&&p.fd==-1&&!p.requirement[0]);assert(!ax_system_peer_prepare(&p,fake_role));}
int main(int argc,char**argv){(void)argv;if(argc==2){reset();fake_role=AX_SYSTEM_PEER_CONTROLLER;AxSystemPeer controller={0};assert(ax_system_peer_prepare(&controller,AX_SYSTEM_PEER_CONTROLLER));assert(ax_system_peer_current(&controller));assert(strstr(checked_path,"AxiomIssuerController"));image[127]^=1;assert(!ax_system_peer_current(&controller));assert(controller.revoked);reset();fake_role=AX_SYSTEM_PEER_CONTROLLER;fake_wrong_id=1;refused();puts("actual protected peer controller positive/currentness/tamper/refusal with inert platform mocks: PASS");return 0;}AxSystemPeer empty={0};int closes=close_calls;ax_system_peer_revoke(&empty);assert(close_calls==closes);AxSystemPeer unowned={.fd=0,.role=AX_SYSTEM_PEER_OWNER};ax_system_peer_revoke(&unowned);assert(close_calls==closes);AxSystemPeer owned={.fd=0,.role=AX_SYSTEM_PEER_OWNER,.opened=1};ax_system_peer_revoke(&owned);assert(close_calls==closes+1);AxSystemPeer p={0};reset();assert(ax_system_peer_prepare(&p,AX_SYSTEM_PEER_OWNER));assert(ax_system_peer_current(&p));assert(!strcmp(ax_system_peer_requirement(&p),"cdhash H\"0102030405060708090a0b0c0d0e0f1011121314\""));ax_system_peer_revoke(&p);assert(!ax_system_peer_current(&p));
 reset();fake_directory_gid=80;memset(&p,0,sizeof p);assert(ax_system_peer_prepare(&p,AX_SYSTEM_PEER_OWNER));ax_system_peer_revoke(&p);
 reset();fake_role=AX_SYSTEM_PEER_BROKER;memset(&p,0,sizeof p);assert(ax_system_peer_prepare(&p,AX_SYSTEM_PEER_BROKER));ax_system_peer_revoke(&p);
 reset();fake_uid=501;refused();reset();fake_gid=20;refused();reset();fake_mode=0775;refused();reset();fake_mode=04755;refused();reset();fake_acl=1;refused();reset();fake_acl=-1;refused();reset();fake_link=2;refused();reset();fake_failopen=1;refused();reset();fake_valid=0;refused();reset();fake_wrong_id=1;refused();reset();fake_wrong_team=1;refused();reset();fake_hash_type=40;refused();reset();fake_digest=1;refused();reset();fake_digest=3;refused();reset();fake_hashlength=32;refused();reset();fake_flags=0;refused();reset();fake_flags=kSecCodeSignatureRuntime|kSecCodeSignatureAdhoc;refused();reset();fake_ent=2;refused();reset();fake_raw=1;refused();reset();fake_mutate=1;refused();assert(fake_mutated);
 reset();((struct mach_header_64*)image)->magic=FAT_MAGIC;refused();reset();((struct mach_header_64*)image)->cputype=CPU_TYPE_X86_64;refused();reset();((struct mach_header_64*)image)->cpusubtype=CPU_SUBTYPE_ARM64E;refused();reset();((struct mach_header_64*)image)->sizeofcmds=UINT32_MAX;refused();
 reset();memset(&p,0,sizeof p);assert(ax_system_peer_prepare(&p,1));image[127]^=1;assert(!ax_system_peer_current(&p));assert(p.revoked);reset();memset(&p,0,sizeof p);assert(ax_system_peer_prepare(&p,1));fake_changed_inode=1;assert(!ax_system_peer_current(&p));
 reset();memset(&p,0,sizeof p);assert(!ax_system_peer_prepare(&p,99));assert(p.revoked);
 puts("actual protected peer helper: positive2 and bounded rejection/currentness cases passed with inert platform mocks");return 0;}
