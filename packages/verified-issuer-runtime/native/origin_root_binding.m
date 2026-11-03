/* Native broker source/readonly-root binding. No identity/grant is returned. */
#define _DARWIN_C_SOURCE 1
#import <Foundation/Foundation.h>
#include "origin_config.h"
#include "origin_root_binding.h"
#include "origin_process_identity.h"
#include <Security/Security.h>
#include <CommonCrypto/CommonDigest.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
static const char*critical[AXIOM_ORIGIN_ANCHORS]={"__axiom_runtime__/origin-bootstrap","__axiom_runtime__/node","node_modules/@axiom/verified-issuer-runtime/index.cjs","node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs","node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node"};
static int hex(NSString*value,size_t length){if(![value isKindOfClass:NSString.class]||value.length!=length)return 0;const char*p=value.UTF8String;if(!p||strlen(p)!=length)return 0;for(size_t i=0;i<length;i++)if(!((p[i]>='0'&&p[i]<='9')||(p[i]>='a'&&p[i]<='f')))return 0;return 1;}
static NSData*bounded(const char*file,size_t maximum){int fd=open(file,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return nil;struct stat before,after,current;if(fstat(fd,&before)||!S_ISREG(before.st_mode)||before.st_size<0||(uint64_t)before.st_size>maximum){close(fd);return nil;}NSMutableData*data=[NSMutableData dataWithLength:(NSUInteger)before.st_size];size_t offset=0;while(offset<(size_t)before.st_size){ssize_t n=read(fd,(char*)data.mutableBytes+offset,(size_t)before.st_size-offset);if(n<=0){close(fd);return nil;}offset+=(size_t)n;}char extra;if(read(fd,&extra,1)!=0||fstat(fd,&after)||lstat(file,&current)||!axiom_origin_same_file_metadata(&before,&after)||!axiom_origin_same_file_metadata(&before,&current)){close(fd);return nil;}close(fd);return data;}
static int sha_regular(const char*file,char out[65],struct stat*identity){
 int fd=open(file,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return 0;struct stat before,after,current;if(fstat(fd,&before)||!S_ISREG(before.st_mode)||before.st_size<0||before.st_size>2LL*1024*1024*1024){close(fd);return 0;}
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
 CC_SHA256_CTX context;CC_SHA256_Init(&context);unsigned char bytes[65536];off_t total=0;
 for(;;){ssize_t count=read(fd,bytes,sizeof(bytes));if(count<0){close(fd);return 0;}if(!count)break;total+=count;if(total>before.st_size){close(fd);return 0;}CC_SHA256_Update(&context,bytes,(CC_LONG)count);}
 unsigned char digest[CC_SHA256_DIGEST_LENGTH];CC_SHA256_Final(digest,&context);
#pragma clang diagnostic pop
 int ok=total==before.st_size&&!fstat(fd,&after)&&!lstat(file,&current)&&axiom_origin_same_file_metadata(&before,&after)&&axiom_origin_same_file_metadata(&before,&current);close(fd);if(!ok)return 0;
 for(size_t i=0;i<sizeof(digest);i++)snprintf(out+2*i,3,"%02x",digest[i]);*identity=before;return 1;
}
static int sealed_control(void){
 if(!AXIOM_ISSUER_CONTROL_APP[0])return 0;char actual[PATH_MAX];if(!realpath(AXIOM_ISSUER_CONTROL_APP,actual)||strcmp(actual,AXIOM_ISSUER_CONTROL_APP))return 0;
 CFURLRef url=CFURLCreateFromFileSystemRepresentation(NULL,(const UInt8*)actual,(CFIndex)strlen(actual),true);if(!url)return 0;SecStaticCodeRef code=NULL;OSStatus status=SecStaticCodeCreateWithPath(url,kSecCSDefaultFlags,&code);CFRelease(url);if(status!=errSecSuccess||!code)return 0;
 /* Source integrity for the exact local packet. This is not a publisher trust
  * catalog or complete execution qualification, and cannot enable readers. */
 int ok=SecStaticCodeCheckValidity(code,kSecCSStrictValidate|kSecCSCheckAllArchitectures,NULL)==errSecSuccess;CFRelease(code);return ok;
}
int axiom_origin_bind_root(AxiomOriginRootBinding*out){@autoreleasepool{
 if(!out)return 0;memset(out,0,sizeof(*out));if(!AXIOM_ISSUER_PACKAGE_ROOT[0]||!AXIOM_ISSUER_IMAGE_BACKING[0]||!AXIOM_ISSUER_CONTROL_APP[0])return 0;
 struct stat backing_before;if(snprintf(out->control_binding_path,sizeof(out->control_binding_path),"%s/Contents/Resources/issuer-binding.plist",AXIOM_ISSUER_CONTROL_APP)>=(int)sizeof(out->control_binding_path)||lstat(out->control_binding_path,&out->control_binding)||!S_ISREG(out->control_binding.st_mode)||lstat(AXIOM_ISSUER_IMAGE_BACKING,&backing_before)||!S_ISREG(backing_before.st_mode)||!sealed_control())return 0;
 char root[PATH_MAX],backing[PATH_MAX];if(!realpath(AXIOM_ISSUER_PACKAGE_ROOT,root)||strcmp(root,AXIOM_ISSUER_PACKAGE_ROOT)||!realpath(AXIOM_ISSUER_IMAGE_BACKING,backing)||strcmp(backing,AXIOM_ISSUER_IMAGE_BACKING)||lstat(root,&out->root)||!S_ISDIR(out->root.st_mode)||lstat(backing,&out->backing)||!S_ISREG(out->backing.st_mode)||!axiom_origin_same_file_metadata(&backing_before,&out->backing)||statfs(root,&out->volume)||!(out->volume.f_flags&MNT_RDONLY)||strcmp(out->volume.f_mntonname,root))return 0;
 NSString*control=[NSString stringWithUTF8String:AXIOM_ISSUER_CONTROL_APP];
 if(![[control stringByAppendingString:@"/Contents/Resources/issuer-package.dmg"] isEqual:[NSString stringWithUTF8String:backing]])return 0;
 NSString*bindingPath=[control stringByAppendingString:@"/Contents/Resources/issuer-binding.plist"];
 NSData*bindingData=bounded(bindingPath.fileSystemRepresentation,16384);if(!bindingData)return 0;id binding=[NSPropertyListSerialization propertyListWithData:bindingData options:NSPropertyListImmutable format:nil error:nil];
 if(![binding isKindOfClass:NSDictionary.class]||[binding count]!=5||![binding[@"format"] isEqual:@"axiom.local-issuer-control/1"]||![binding[@"packageRoot"] isEqual:[NSString stringWithUTF8String:root]]||![binding[@"imageBacking"] isEqual:[NSString stringWithUTF8String:backing]]||!hex(binding[@"manifestSha256"],64)||!hex(binding[@"sourceRevision"],40))return 0;
 char manifest[PATH_MAX],digest[65];struct stat manifest_stat;if(snprintf(manifest,sizeof(manifest),"%s/_axiom_local_issuer_manifest.json",root)>=(int)sizeof(manifest)||lstat(manifest,&manifest_stat)||!S_ISREG(manifest_stat.st_mode)||manifest_stat.st_size>64LL*1024*1024||!sha_regular(manifest,digest,&manifest_stat)||strcmp(digest,[binding[@"manifestSha256"] UTF8String]))return 0;
 NSData*manifestData=bounded(manifest,64U*1024U*1024U);if(!manifestData)return 0;id tree=[NSJSONSerialization JSONObjectWithData:manifestData options:0 error:nil];if(![tree isKindOfClass:NSDictionary.class]||![tree[@"format"] isEqual:@"axiom.local-issuer-package/1"]||![tree[@"provenance"] isKindOfClass:NSDictionary.class]||![tree[@"provenance"][@"sourceRevision"] isEqual:binding[@"sourceRevision"]]||![tree[@"files"] isKindOfClass:NSArray.class]||[tree[@"files"] count]>250000)return 0;
 for(size_t i=0;i<AXIOM_ORIGIN_ANCHORS;i++){
  char logical[PATH_MAX];if(snprintf(logical,sizeof(logical),"%s/%s",root,critical[i])>=(int)sizeof(logical)||!realpath(logical,out->anchors[i].path)||strncmp(out->anchors[i].path,root,strlen(root))||out->anchors[i].path[strlen(root)]!='/')return 0;
  NSString*relative=[NSString stringWithUTF8String:out->anchors[i].path+strlen(root)+1];NSDictionary*entry=nil;
  for(id item in tree[@"files"]){if(![item isKindOfClass:NSDictionary.class])return 0;if([item[@"path"] isEqual:relative]){if(entry)return 0;entry=item;}}
  if(!entry||!hex(entry[@"sha256"],64)||![entry[@"size"] isKindOfClass:NSNumber.class]||![entry[@"mode"] isKindOfClass:NSNumber.class]||!sha_regular(out->anchors[i].path,digest,&out->anchors[i].identity)||strcmp(digest,[entry[@"sha256"] UTF8String])||out->anchors[i].identity.st_size!=[entry[@"size"] longLongValue]||(out->anchors[i].identity.st_mode&0777)!=[entry[@"mode"] unsignedIntValue])return 0;
 }
 /* The anchored fixed main/verifier hashes the FULL closed package before app
  * imports and before native ACK. No unverified Node/script verifies itself. */
 out->bound=1;return axiom_origin_root_current(out);
}}
int axiom_origin_root_current(const AxiomOriginRootBinding*startup){
 if(!startup||startup->bound!=1)return 0;struct stat root,backing,binding;struct statfs volume;
 if(lstat(AXIOM_ISSUER_PACKAGE_ROOT,&root)||lstat(AXIOM_ISSUER_IMAGE_BACKING,&backing)||lstat(startup->control_binding_path,&binding)||!axiom_origin_same_file_metadata(&startup->control_binding,&binding)||statfs(AXIOM_ISSUER_PACKAGE_ROOT,&volume)||!(volume.f_flags&MNT_RDONLY)||!memchr(volume.f_mntonname,0,sizeof(volume.f_mntonname))||!memchr(volume.f_mntfromname,0,sizeof(volume.f_mntfromname))||strcmp(volume.f_mntonname,AXIOM_ISSUER_PACKAGE_ROOT)||memcmp(&startup->volume.f_fsid,&volume.f_fsid,sizeof(volume.f_fsid))||strcmp(startup->volume.f_mntfromname,volume.f_mntfromname)||!axiom_origin_same_file_metadata(&startup->root,&root)||!axiom_origin_same_file_metadata(&startup->backing,&backing))return 0;
 for(size_t i=0;i<AXIOM_ORIGIN_ANCHORS;i++){struct stat current;if(lstat(startup->anchors[i].path,&current)||!axiom_origin_same_file_metadata(&startup->anchors[i].identity,&current))return 0;}return 1;
}
