#define _DARWIN_C_SOURCE 1
#include "protected_resource_inventory.h"
#include <libproc.h>
#include <sys/proc_info.h>
#include <mach/mach.h>
#include <mach/mach_vm.h>
#include <mach/vm_region.h>
#include <unistd.h>
#include <string.h>
int axiom_collect_protected_region(uintptr_t wanted,AxiomProtectedRegion*out){
 if(!out)return 0;memset(out,0,sizeof(*out));mach_vm_address_t address=wanted;mach_vm_size_t size=0;natural_t depth=0;vm_region_submap_info_data_64_t info;mach_msg_type_number_t count;unsigned steps=0;
 do{if(++steps>64)return 0;count=VM_REGION_SUBMAP_INFO_COUNT_64;memset(&info,0,sizeof(info));if(mach_vm_region_recurse(mach_task_self(),&address,&size,&depth,(vm_region_recurse_info_t)&info,&count)!=KERN_SUCCESS||count!=VM_REGION_SUBMAP_INFO_COUNT_64||!size)return 0;if(info.is_submap){depth++;address=wanted;}else break;}while(1);
 if(address>wanted||wanted-address>=size)return 0;
 mach_vm_address_t basic_address=wanted;mach_vm_size_t basic_size=0;vm_region_basic_info_data_64_t basic;mach_msg_type_number_t basic_count=VM_REGION_BASIC_INFO_COUNT_64;mach_port_t object=MACH_PORT_NULL;memset(&basic,0,sizeof(basic));kern_return_t k=mach_vm_region(mach_task_self(),&basic_address,&basic_size,VM_REGION_BASIC_INFO_64,(vm_region_info_t)&basic,&basic_count,&object);if(object!=MACH_PORT_NULL)mach_port_deallocate(mach_task_self(),object);if(k!=KERN_SUCCESS||basic_count!=VM_REGION_BASIC_INFO_COUNT_64||basic_address>wanted||wanted-basic_address>=basic_size)return 0;
 struct proc_regionwithpathinfo path;memset(&path,0,sizeof(path));int bytes=proc_pidinfo(getpid(),PROC_PIDREGIONPATHINFO,wanted,&path,sizeof(path));if(bytes!=(int)sizeof(path)||path.prp_prinfo.pri_address>wanted||wanted-path.prp_prinfo.pri_address>=path.prp_prinfo.pri_size||!memchr(path.prp_vip.vip_path,0,sizeof(path.prp_vip.vip_path)))return 0;
 out->address=address;out->size=size;out->external_pager=info.external_pager;out->share_mode=info.share_mode;out->protection=info.protection;out->max_protection=info.max_protection;out->basic_shared=basic.shared;out->region_flags=path.prp_prinfo.pri_flags;out->device=path.prp_vip.vip_vi.vi_stat.vst_dev;out->inode=path.prp_vip.vip_vi.vi_stat.vst_ino;out->vnode_present=out->inode!=0;out->vnode_exact=path.prp_prinfo.pri_address==address&&path.prp_prinfo.pri_size==size;memcpy(out->path,path.prp_vip.vip_path,sizeof(path.prp_vip.vip_path));return 1;
}
#include <sys/mount.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <stdlib.h>
#include <limits.h>
AxiomResourceDecision axiom_classify_protected_descriptor(const AxiomProtectedResources*r,uint64_t device,uint64_t inode,int access){
 if(!r||!r->root_readonly||!r->backing_inode||(access!=O_RDONLY&&access!=O_WRONLY&&access!=O_RDWR))return AXIOM_RESOURCE_INCOMPLETE;
 if(access!=O_RDONLY&&(device==r->root_device||(device==r->backing_device&&inode==r->backing_inode)))return AXIOM_RESOURCE_VIOLATION;
 return AXIOM_RESOURCE_OBSERVED;
}
AxiomResourceDecision axiom_classify_protected_region(const AxiomProtectedResources*r,const AxiomProtectedRegion*m){
 if(!r||!m||!r->root_readonly||!r->backing_inode||(m->protection&~7U)||(m->max_protection&~7U)||(m->protection&~m->max_protection)||m->external_pager>1||m->vnode_present!=(m->inode!=0))return AXIOM_RESOURCE_INCOMPLETE;
 /* Never infer private/anonymous provenance from VM share mode or absent vnode.
  * Readonly mounted-root COW mappings are not backing-file write capabilities.
  * Any raw image maxwrite mapping is conservatively refused, even if COW. */
 if(m->vnode_present&&m->device==r->backing_device&&m->inode==r->backing_inode&&(m->max_protection&VM_PROT_WRITE))return AXIOM_RESOURCE_VIOLATION;
 return AXIOM_RESOURCE_OBSERVED;
}
typedef struct {int fd;unsigned kind;int flags;uint64_t dev,ino;mode_t mode;} ResourceFd;
typedef struct {uint64_t address,size,device,inode;unsigned protection,max_protection,external_pager,share_mode,basic_shared,region_flags;int vnode_present,vnode_exact;} ResourceMap;
static AxiomProtectedInventoryReport failed(AxiomProtectedInventoryReport report,AxiomResourceDecision d,const char*reason){report.decision=d;report.reason=reason;return report;}
static int order_fd(const void*a,const void*b){int x=((const struct proc_fdinfo*)a)->proc_fd,y=((const struct proc_fdinfo*)b)->proc_fd;return(x>y)-(x<y);}
static int resource_fd_snapshot(const AxiomProtectedResources*r,ResourceFd*out,size_t*count,AxiomProtectedInventoryReport*report){
 struct proc_fdinfo list[AXIOM_RESOURCE_MAX_FDS+1];int bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,list,sizeof(list));
 if(bytes<=0||bytes%(int)sizeof(list[0])||bytes>=(int)sizeof(list)){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"descriptor_inventory_incomplete");return 0;}
 size_t n=(size_t)bytes/sizeof(list[0]);qsort(list,n,sizeof(list[0]),order_fd);
 for(size_t i=0;i<n;i++){int fd=list[i].proc_fd;if(fd<0||(i&&fd==list[i-1].proc_fd)){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"descriptor_inventory_changed");return 0;}
  struct stat before,after;int flags=fcntl(fd,F_GETFL);if(flags<0||fstat(fd,&before)||fstat(fd,&after)||before.st_dev!=after.st_dev||before.st_ino!=after.st_ino||before.st_mode!=after.st_mode||flags!=fcntl(fd,F_GETFL)){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"descriptor_metadata_changed");return 0;}
  if(list[i].proc_fdtype==PROX_FDTYPE_VNODE){AxiomResourceDecision d=axiom_classify_protected_descriptor(r,(uint64_t)(uint32_t)before.st_dev,(uint64_t)before.st_ino,flags&O_ACCMODE);if(d!=AXIOM_RESOURCE_OBSERVED){*report=failed(*report,d,"protected_descriptor_capability");return 0;}}
  out[i]=(ResourceFd){fd,list[i].proc_fdtype,flags,(uint64_t)(uint32_t)before.st_dev,(uint64_t)before.st_ino,before.st_mode};
 }
 *count=n;report->descriptor_count=n;report->descriptor_scan_complete=1;return 1;
}
static int resource_vm_snapshot(const AxiomProtectedResources*r,ResourceMap*out,size_t*count,AxiomProtectedInventoryReport*report){
 mach_vm_address_t address=0;natural_t depth=0;size_t n=0,steps=0,unattributed=0,maxwrite=0;
 while(1){if(++steps>AXIOM_RESOURCE_MAX_REGIONS*4U||depth>64||n>=AXIOM_RESOURCE_MAX_REGIONS){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"mapping_inventory_bound");return 0;}
  mach_vm_size_t size=0;vm_region_submap_info_data_64_t info;memset(&info,0,sizeof(info));mach_msg_type_number_t length=VM_REGION_SUBMAP_INFO_COUNT_64;
  kern_return_t k=mach_vm_region_recurse(mach_task_self(),&address,&size,&depth,(vm_region_recurse_info_t)&info,&length);
  if(k==KERN_INVALID_ADDRESS){if(!n){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"mapping_inventory_empty");return 0;}break;}
  if(k!=KERN_SUCCESS||length!=VM_REGION_SUBMAP_INFO_COUNT_64||!size||address>UINT64_MAX-size){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"mapping_inventory_incomplete");return 0;}
  if(info.is_submap){depth++;continue;}
  AxiomProtectedRegion m;if(!axiom_collect_protected_region(address,&m)||m.address!=address||m.size!=size||m.protection!=(unsigned)info.protection||m.max_protection!=(unsigned)info.max_protection){*report=failed(*report,AXIOM_RESOURCE_INCOMPLETE,"mapping_metadata_incomplete");return 0;}
  AxiomResourceDecision d=axiom_classify_protected_region(r,&m);if(d!=AXIOM_RESOURCE_OBSERVED){*report=failed(*report,d,"protected_backing_mapping_capability");return 0;}
  if(!m.vnode_present||!m.vnode_exact){unattributed++;if(m.max_protection&VM_PROT_WRITE)maxwrite++;}
  out[n++]=(ResourceMap){m.address,m.size,m.device,m.inode,m.protection,m.max_protection,m.external_pager,m.share_mode,m.basic_shared,m.region_flags,m.vnode_present,m.vnode_exact};address+=size;
 }
 *count=n;report->region_count=n;report->unattributed_region_count=unattributed;report->unattributed_maxwrite_count=maxwrite;report->region_scan_complete=1;return 1;
}
static int protected_context(const char*root,const char*backing,AxiomProtectedResources*out,struct stat*root_stat,struct stat*backing_stat){
 char actual_root[PATH_MAX],actual_backing[PATH_MAX];struct statfs fs;
 if(!root||!backing||!realpath(root,actual_root)||strcmp(actual_root,root)||!realpath(backing,actual_backing)||strcmp(actual_backing,backing)||lstat(root,root_stat)||!S_ISDIR(root_stat->st_mode)||lstat(backing,backing_stat)||!S_ISREG(backing_stat->st_mode)||statfs(root,&fs)||!(fs.f_flags&MNT_RDONLY)||strcmp(fs.f_mntonname,root))return 0;
 *out=(AxiomProtectedResources){(uint64_t)(uint32_t)root_stat->st_dev,(uint64_t)(uint32_t)backing_stat->st_dev,(uint64_t)backing_stat->st_ino,1};return 1;
}
AxiomProtectedInventoryReport axiom_protected_inventory_own(const char*root,const char*backing){
 AxiomProtectedInventoryReport report={0};report.decision=AXIOM_RESOURCE_OBSERVED;report.reason="resource_observations_only_provenance_unproven";AxiomProtectedResources resources;struct stat root_before,backing_before,root_after,backing_after;
 if(!protected_context(root,backing,&resources,&root_before,&backing_before))return failed(report,AXIOM_RESOURCE_INCOMPLETE,"fixed_readonly_root_or_backing_unverified");
 ResourceFd*a=calloc(AXIOM_RESOURCE_MAX_FDS,sizeof(*a)),*b=calloc(AXIOM_RESOURCE_MAX_FDS,sizeof(*b));ResourceMap*x=calloc(AXIOM_RESOURCE_MAX_REGIONS,sizeof(*x)),*y=calloc(AXIOM_RESOURCE_MAX_REGIONS,sizeof(*y));
 if(!a||!b||!x||!y){report=failed(report,AXIOM_RESOURCE_INCOMPLETE,"inventory_memory_bound");goto done;}
 size_t na=0,nb=0,nx=0,ny=0;if(!resource_fd_snapshot(&resources,a,&na,&report)||!resource_vm_snapshot(&resources,x,&nx,&report)||!resource_vm_snapshot(&resources,y,&ny,&report)||!resource_fd_snapshot(&resources,b,&nb,&report))goto done;
 if(na!=nb||nx!=ny){report=failed(report,AXIOM_RESOURCE_INCOMPLETE,"resource_inventory_changed");goto done;}
 for(size_t i=0;i<na;i++)if(a[i].fd!=b[i].fd||a[i].kind!=b[i].kind||a[i].flags!=b[i].flags||a[i].dev!=b[i].dev||a[i].ino!=b[i].ino||a[i].mode!=b[i].mode){report=failed(report,AXIOM_RESOURCE_INCOMPLETE,"descriptor_inventory_changed");goto done;}
 for(size_t i=0;i<nx;i++)if(x[i].address!=y[i].address||x[i].size!=y[i].size||x[i].device!=y[i].device||x[i].inode!=y[i].inode||x[i].protection!=y[i].protection||x[i].max_protection!=y[i].max_protection||x[i].external_pager!=y[i].external_pager||x[i].share_mode!=y[i].share_mode||x[i].basic_shared!=y[i].basic_shared||x[i].region_flags!=y[i].region_flags||x[i].vnode_present!=y[i].vnode_present||x[i].vnode_exact!=y[i].vnode_exact){report=failed(report,AXIOM_RESOURCE_INCOMPLETE,"mapping_inventory_changed");goto done;}
 AxiomProtectedResources after;if(!protected_context(root,backing,&after,&root_after,&backing_after)||(resources.root_device!=after.root_device||resources.backing_device!=after.backing_device||resources.backing_inode!=after.backing_inode||resources.root_readonly!=after.root_readonly)||root_before.st_dev!=root_after.st_dev||root_before.st_ino!=root_after.st_ino||backing_before.st_dev!=backing_after.st_dev||backing_before.st_ino!=backing_after.st_ino||backing_before.st_size!=backing_after.st_size||backing_before.st_mode!=backing_after.st_mode){report=failed(report,AXIOM_RESOURCE_INCOMPLETE,"protected_resource_changed");goto done;}
 report.stable=1;
 done:free(a);free(b);free(x);free(y);return report;
}
