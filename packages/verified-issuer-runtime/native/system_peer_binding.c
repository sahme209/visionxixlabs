#define _DARWIN_C_SOURCE 1
#include "system_peer_binding.h"
#include "owner_config.h"
#include <Security/Security.h>
#include <CommonCrypto/CommonDigest.h>
#include <mach-o/loader.h>
#include <mach/machine.h>
#include <sys/acl.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#define AX_SYSTEM_PEER_MAX_BYTES (16U*1024U*1024U)
#define AX_SYSTEM_PEER_TEAM "FG5N98FE6W"
#define AX_SYSTEM_PEER_OWNER_ID "com.visionxixlabs.axiom.synthetic.launch-owner"
#define AX_SYSTEM_PEER_BROKER_ID "com.visionxixlabs.axiom.synthetic.broker"
static const char*peer_path(int role){return role==AX_SYSTEM_PEER_OWNER?AX_OWNER_PATH:role==AX_SYSTEM_PEER_BROKER?AX_SYNTH_BROKER:NULL;}
static const char*peer_identifier(int role){return role==AX_SYSTEM_PEER_OWNER?AX_SYSTEM_PEER_OWNER_ID:role==AX_SYSTEM_PEER_BROKER?AX_SYSTEM_PEER_BROKER_ID:NULL;}
static int metadata_equal(const struct stat*a,const struct stat*b){return a->st_dev==b->st_dev&&a->st_ino==b->st_ino&&a->st_uid==b->st_uid&&a->st_gid==b->st_gid&&a->st_mode==b->st_mode&&a->st_nlink==b->st_nlink&&a->st_size==b->st_size&&a->st_mtimespec.tv_sec==b->st_mtimespec.tv_sec&&a->st_mtimespec.tv_nsec==b->st_mtimespec.tv_nsec&&a->st_ctimespec.tv_sec==b->st_ctimespec.tv_sec&&a->st_ctimespec.tv_nsec==b->st_ctimespec.tv_nsec;}
static int protected_fd(int fd,int directory,struct stat*out){
 struct stat s;if(fstat(fd,&s)||s.st_uid!=0||(!directory&&s.st_gid!=0)||(s.st_mode&07777)!=0755||!(directory?S_ISDIR(s.st_mode):S_ISREG(s.st_mode))||(!directory&&(s.st_nlink!=1||s.st_size<(off_t)sizeof(struct mach_header_64)||s.st_size>AX_SYSTEM_PEER_MAX_BYTES)))return 0;
 acl_t acl=acl_get_fd_np(fd,ACL_TYPE_EXTENDED);if(!acl)return 0;acl_entry_t entry;int n=acl_get_entry(acl,ACL_FIRST_ENTRY,&entry);int freed=acl_free(acl);if(n!=0||freed)return 0;if(out)*out=s;return 1;
}
static int open_peer(int role,struct stat*out){
 const char*path=peer_path(role);if(!path||path[0]!='/')return -1;char copy[PATH_MAX];if(strlen(path)>=sizeof copy)return -1;memcpy(copy,path,strlen(path)+1);
 int fd=open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return -1;if(!protected_fd(fd,1,NULL)){close(fd);return -1;}
 char*save=NULL,*part=strtok_r(copy,"/",&save);while(part){char*next_part=strtok_r(NULL,"/",&save);if(!strcmp(part,".")||!strcmp(part,"..")||!part[0]){close(fd);return -1;}
 int next=openat(fd,part,O_RDONLY|O_NOFOLLOW|O_CLOEXEC|(next_part?O_DIRECTORY:0));int closed=close(fd);if(next<0||closed){if(next>=0)close(next);return -1;}fd=next;
 if(!protected_fd(fd,next_part!=NULL,next_part?NULL:out)){close(fd);return -1;}part=next_part;}return fd;
}
static int hash_image(int fd,const struct stat*expected,unsigned char out[32]){
 struct stat before,after;if(!protected_fd(fd,0,&before)||!metadata_equal(expected,&before))return 0;
 unsigned char*bytes=malloc((size_t)before.st_size);if(!bytes)return 0;size_t used=0;int ok=1;
 while(used<(size_t)before.st_size){ssize_t n=pread(fd,bytes+used,(size_t)before.st_size-used,(off_t)used);if(n<0&&errno==EINTR)continue;if(n<=0){ok=0;break;}used+=(size_t)n;}
 unsigned char sentinel;if(ok&&pread(fd,&sentinel,1,before.st_size)!=0)ok=0;
 if(ok){struct mach_header_64 header;memcpy(&header,bytes,sizeof header);ok=header.magic==MH_MAGIC_64&&header.cputype==CPU_TYPE_ARM64&&header.cpusubtype==CPU_SUBTYPE_ARM64_ALL&&header.filetype==MH_EXECUTE&&header.sizeofcmds<=(uint32_t)(before.st_size-(off_t)sizeof header)&&header.ncmds>0&&header.ncmds<=header.sizeofcmds/sizeof(struct load_command);}
 if(ok)ok=CC_SHA256(bytes,(CC_LONG)used,out)!=NULL;free(bytes);
 return ok&&protected_fd(fd,0,&after)&&metadata_equal(&before,&after);
}
static int number(CFDictionaryRef d,CFStringRef key,int expected){CFTypeRef value=CFDictionaryGetValue(d,key);int result=0;return value&&CFGetTypeID(value)==CFNumberGetTypeID()&&CFNumberGetValue((CFNumberRef)value,kCFNumberIntType,&result)&&result==expected;}
static int string(CFDictionaryRef d,CFStringRef key,const char*expected){CFTypeRef value=CFDictionaryGetValue(d,key);char buffer[128];return value&&CFGetTypeID(value)==CFStringGetTypeID()&&CFStringGetCString((CFStringRef)value,buffer,sizeof buffer,kCFStringEncodingUTF8)&&!strcmp(buffer,expected);}
static int signing_profile(int role,unsigned char cdhash[20]){
 const char*path=peer_path(role),*identifier=peer_identifier(role);if(!path||!identifier)return 0;
 char expectation[256];int n=snprintf(expectation,sizeof expectation,"anchor apple generic and certificate leaf[subject.OU] = \"%s\" and identifier \"%s\"",AX_SYSTEM_PEER_TEAM,identifier);if(n<1||(size_t)n>=sizeof expectation)return 0;
 CFURLRef url=CFURLCreateFromFileSystemRepresentation(NULL,(const UInt8*)path,(CFIndex)strlen(path),false);if(!url)return 0;SecStaticCodeRef code=NULL;SecRequirementRef requirement=NULL;CFDictionaryRef info=NULL;CFStringRef text=CFStringCreateWithCString(NULL,expectation,kCFStringEncodingUTF8);int ok=0;
 if(!text||SecRequirementCreateWithString(text,kSecCSDefaultFlags,&requirement)!=errSecSuccess||!requirement||SecStaticCodeCreateWithPath(url,kSecCSDefaultFlags,&code)!=errSecSuccess||!code)goto done;
 if(SecStaticCodeCheckValidity(code,kSecCSStrictValidate|kSecCSCheckAllArchitectures,requirement)!=errSecSuccess||SecCodeCopySigningInformation((SecCodeRef)code,kSecCSSigningInformation,&info)!=errSecSuccess||!info||CFGetTypeID(info)!=CFDictionaryGetTypeID())goto done;
 if(!number(info,kSecCodeInfoFlags,kSecCodeSignatureRuntime)||!number(info,kSecCodeInfoDigestAlgorithm,kSecCodeSignatureHashSHA256)||!string(info,kSecCodeInfoIdentifier,identifier)||!string(info,kSecCodeInfoTeamIdentifier,AX_SYSTEM_PEER_TEAM))goto done;
 CFTypeRef ent=CFDictionaryGetValue(info,kSecCodeInfoEntitlementsDict),raw=CFDictionaryGetValue(info,kSecCodeInfoEntitlements);
 if(ent){if(CFGetTypeID(ent)!=CFDictionaryGetTypeID()||CFDictionaryGetCount((CFDictionaryRef)ent)!=0)goto done;}else if(raw)goto done;
 CFTypeRef hash=CFDictionaryGetValue(info,kSecCodeInfoUnique);if(!hash||CFGetTypeID(hash)!=CFDataGetTypeID()||CFDataGetLength((CFDataRef)hash)!=20||!CFDataGetBytePtr((CFDataRef)hash))goto done;
 memcpy(cdhash,CFDataGetBytePtr((CFDataRef)hash),20);ok=1;
 done:if(info)CFRelease(info);if(code)CFRelease(code);if(requirement)CFRelease(requirement);if(text)CFRelease(text);CFRelease(url);return ok;
}
void ax_system_peer_revoke(AxSystemPeer*p){if(!p)return;if(p->opened&&p->fd>=0)close(p->fd);p->fd=-1;p->opened=0;p->captured=0;p->revoked=1;memset(p->requirement,0,sizeof p->requirement);}
int ax_system_peer_prepare(AxSystemPeer*p,int role){
 if(!p||p->captured||p->revoked)return 0;p->fd=-1;p->opened=0;p->role=role;if(!peer_path(role))goto refused;
 p->fd=open_peer(role,&p->identity);if(p->fd<0)goto refused;p->opened=1;unsigned char first[32],second[32];
 if(!hash_image(p->fd,&p->identity,first)||!signing_profile(role,p->cdhash)||!hash_image(p->fd,&p->identity,second)||memcmp(first,second,32))goto refused;
 memcpy(p->bytes_sha256,first,32);memcpy(p->requirement,"cdhash H\"",9);static const char hex[]="0123456789abcdef";for(unsigned i=0;i<20;i++){p->requirement[9+i*2]=hex[p->cdhash[i]>>4];p->requirement[10+i*2]=hex[p->cdhash[i]&15];}p->requirement[49]='"';p->requirement[50]=0;p->captured=1;
 if(ax_system_peer_current(p))return 1;
 refused:ax_system_peer_revoke(p);return 0;
}
int ax_system_peer_current(AxSystemPeer*p){
 if(!p||!p->captured||p->revoked)return 0;struct stat current;int fd=open_peer(p->role,&current);int ok=fd>=0&&metadata_equal(&p->identity,&current);unsigned char held_hash[32],path_hash[32];if(ok)ok=hash_image(p->fd,&p->identity,held_hash)&&hash_image(fd,&current,path_hash)&&!memcmp(held_hash,p->bytes_sha256,32)&&!memcmp(path_hash,p->bytes_sha256,32);if(fd>=0&&close(fd))ok=0;
 if(!ok)ax_system_peer_revoke(p);return ok;
}
const char*ax_system_peer_requirement(AxSystemPeer*p){return ax_system_peer_current(p)?p->requirement:NULL;}
