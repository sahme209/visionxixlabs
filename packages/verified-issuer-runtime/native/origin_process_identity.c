#define _DARWIN_C_SOURCE 1
#include "origin_config.h"
#include "origin_process_identity.h"
#include "protected_resource_inventory.h"
#include <mach/vm_prot.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
static int file(const char*raw,char resolved[PATH_MAX],struct stat*out,int directory){
 if(!raw||!raw[0]||!realpath(raw,resolved)||lstat(resolved,out))return 0;
 return directory?S_ISDIR(out->st_mode):S_ISREG(out->st_mode);
}
static int fixed_file(const char*root,const char*suffix,char path[PATH_MAX],struct stat*out){char raw[PATH_MAX];if(snprintf(raw,sizeof(raw),"%s/%s",root,suffix)>=(int)sizeof(raw))return 0;return file(raw,path,out,0);}
int axiom_origin_same_file_metadata(const struct stat*a,const struct stat*b){if(!a||!b)return 0;return a->st_dev==b->st_dev&&a->st_ino==b->st_ino&&a->st_mode==b->st_mode&&a->st_uid==b->st_uid&&a->st_gid==b->st_gid&&a->st_size==b->st_size&&a->st_nlink==b->st_nlink&&a->st_mtimespec.tv_sec==b->st_mtimespec.tv_sec&&a->st_mtimespec.tv_nsec==b->st_mtimespec.tv_nsec&&a->st_ctimespec.tv_sec==b->st_ctimespec.tv_sec&&a->st_ctimespec.tv_nsec==b->st_ctimespec.tv_nsec;}
int axiom_origin_loaded_file_matches(uintptr_t address,const struct stat*expected){if(!expected)return 0;AxiomProtectedRegion region;if(!address||!axiom_collect_protected_region(address,&region))return 0;return region.vnode_present&&region.vnode_exact&&region.device==(uint64_t)(uint32_t)expected->st_dev&&region.inode==(uint64_t)expected->st_ino&&(region.protection&VM_PROT_EXECUTE)&&!(region.protection&VM_PROT_WRITE);}
int axiom_origin_identity_capture(uintptr_t addon_code,uintptr_t node_code,AxiomOriginProcessIdentity*out){
 if(!out)return 0;memset(out,0,sizeof(*out));
 if(!file(AXIOM_ISSUER_PACKAGE_ROOT,out->root,&out->root_stat,1)||strcmp(out->root,AXIOM_ISSUER_PACKAGE_ROOT)||!file(AXIOM_ISSUER_IMAGE_BACKING,out->backing,&out->backing_stat,0))return 0;
 if(statfs(out->root,&out->volume)||!(out->volume.f_flags&MNT_RDONLY)||!memchr(out->volume.f_mntonname,0,sizeof(out->volume.f_mntonname))||!memchr(out->volume.f_mntfromname,0,sizeof(out->volume.f_mntfromname))||strcmp(out->volume.f_mntonname,out->root))return 0;
 if(!fixed_file(out->root,"__axiom_runtime__/node",out->node,&out->node_stat)||!fixed_file(out->root,"node_modules/@axiom/verified-issuer-runtime/index.cjs",out->main,&out->main_stat)||!fixed_file(out->root,"node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node",out->addon,&out->addon_stat))return 0;
 char cwd[PATH_MAX],canonical[PATH_MAX];struct stat cwd_stat;if(!getcwd(cwd,sizeof(cwd))||!realpath(cwd,canonical)||strcmp(canonical,out->root)||stat(".",&cwd_stat)||cwd_stat.st_dev!=out->root_stat.st_dev||cwd_stat.st_ino!=out->root_stat.st_ino)return 0;
 if(!axiom_origin_loaded_file_matches(addon_code,&out->addon_stat)||!axiom_origin_loaded_file_matches(node_code,&out->node_stat))return 0;
 out->addon_code=addon_code;out->node_code=node_code;out->captured=1;return 1;
}
int axiom_origin_identity_current(const AxiomOriginProcessIdentity*startup){
 if(!startup||startup->captured!=1)return 0;AxiomOriginProcessIdentity now;
 if(!axiom_origin_identity_capture(startup->addon_code,startup->node_code,&now))return 0;
 return !strcmp(startup->root,now.root)&&!strcmp(startup->backing,now.backing)&&!strcmp(startup->node,now.node)&&!strcmp(startup->main,now.main)&&!strcmp(startup->addon,now.addon)&&axiom_origin_same_file_metadata(&startup->root_stat,&now.root_stat)&&axiom_origin_same_file_metadata(&startup->backing_stat,&now.backing_stat)&&axiom_origin_same_file_metadata(&startup->node_stat,&now.node_stat)&&axiom_origin_same_file_metadata(&startup->main_stat,&now.main_stat)&&axiom_origin_same_file_metadata(&startup->addon_stat,&now.addon_stat)&&!memcmp(&startup->volume.f_fsid,&now.volume.f_fsid,sizeof(now.volume.f_fsid))&&!strcmp(startup->volume.f_mntfromname,now.volume.f_mntfromname);
}
