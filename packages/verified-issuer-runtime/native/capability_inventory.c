#define _DARWIN_C_SOURCE 1
#include "capability_inventory.h"
#include <libproc.h>
#include <sys/proc_info.h>
#include <sys/stat.h>
#include <mach/mach.h>
#include <mach/mach_vm.h>
#include <mach/vm_region.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <stdint.h>

typedef struct {struct proc_fdinfo info;int flags;struct stat stat;} FdSnapshot;
typedef struct {mach_vm_address_t address;mach_vm_size_t size;AxiomVmMetadata metadata;} VmSnapshot;
static AxiomInventoryReport failure(AxiomInventoryReport r,AxiomMetadataDecision d,const char *reason){r.decision=d;r.reason=reason;return r;}
AxiomMetadataDecision axiom_descriptor_count_from_bytes(int bytes,size_t *count){
 if(!count)return AXIOM_META_UNKNOWN;*count=0;
 if(bytes<=0||bytes%(int)sizeof(struct proc_fdinfo)||bytes>=(int)((AXIOM_MAX_FDS+1)*sizeof(struct proc_fdinfo)))return AXIOM_META_UNKNOWN;
 size_t n=(size_t)bytes/sizeof(struct proc_fdinfo);if(n>AXIOM_MAX_FDS)return AXIOM_META_UNKNOWN;*count=n;return AXIOM_META_ALLOWED;
}
AxiomMetadataDecision axiom_vm_leaf_progress(uint64_t address,uint64_t size,size_t count){return !size||count>=AXIOM_MAX_VM_REGIONS||address>UINT64_MAX-size?AXIOM_META_UNKNOWN:AXIOM_META_ALLOWED;}
AxiomMetadataDecision axiom_classify_fd(const AxiomFdMetadata *m){
 if(!m||!m->stable||m->fd<0||(m->access_mode!=O_RDONLY&&m->access_mode!=O_WRONLY&&m->access_mode!=O_RDWR))return AXIOM_META_UNKNOWN;
 if(m->kind==PROX_FDTYPE_VNODE){
  if(m->access_mode!=O_RDONLY)return AXIOM_META_REFUSED;
  if(m->fd==0)return m->devnull?AXIOM_META_ALLOWED:AXIOM_META_REFUSED;
  if(m->fd==1||m->fd==2)return AXIOM_META_REFUSED;
  return m->readonly_path_allowed?AXIOM_META_ALLOWED:AXIOM_META_REFUSED;
 }
 if(m->fd==0)return AXIOM_META_REFUSED;
 if(m->kind==PROX_FDTYPE_PIPE){if(m->fd==1||m->fd==2)return m->access_mode==O_WRONLY?AXIOM_META_ALLOWED:AXIOM_META_REFUSED;return m->access_mode==O_RDONLY||m->access_mode==O_WRONLY?AXIOM_META_ALLOWED:AXIOM_META_UNKNOWN;}
 if(m->fd<=2)return AXIOM_META_REFUSED;
 if(m->kind==PROX_FDTYPE_KQUEUE)return AXIOM_META_ALLOWED;
 /* Pre-import sockets/PSHM/devices/unknown types do not get implicit exceptions. */
 return m->kind==PROX_FDTYPE_SOCKET||m->kind==PROX_FDTYPE_PSHM?AXIOM_META_REFUSED:AXIOM_META_UNKNOWN;
}
AxiomMetadataDecision axiom_classify_vm(const AxiomVmMetadata *m){
 if(!m||!m->complete||m->external_pager>1||(m->protection&~7U)||(m->max_protection&~7U)||(m->protection&~m->max_protection))return AXIOM_META_UNKNOWN;
 switch(m->share_mode){case SM_COW:case SM_PRIVATE:case SM_EMPTY:case SM_SHARED:case SM_TRUESHARED:case SM_PRIVATE_ALIASED:case SM_SHARED_ALIASED:case SM_LARGE_PAGE:break;default:return AXIOM_META_UNKNOWN;}
 if(!(m->max_protection&VM_PROT_WRITE))return AXIOM_META_ALLOWED;
 if(m->share_mode==SM_COW||m->share_mode==SM_PRIVATE)return AXIOM_META_ALLOWED;
 /* Missing pathname is not anonymous-memory proof. Conservatively refuse every
  * shared/ambiguous maximum-write region, even if currently readonly. Public
  * share_mode metadata itself still needs actual runtime qualification. */
 return AXIOM_META_REFUSED;
}
static int fd_order(const void*a,const void*b){int x=((const struct proc_fdinfo*)a)->proc_fd,y=((const struct proc_fdinfo*)b)->proc_fd;return(x>y)-(x<y);}
static int same_stat(const struct stat*a,const struct stat*b){return a->st_dev==b->st_dev&&a->st_ino==b->st_ino&&a->st_mode==b->st_mode&&a->st_rdev==b->st_rdev;}
static int allowed_readonly_path(int fd,const char*root){
 if(!root)return 0;struct vnode_fdinfowithpath v;memset(&v,0,sizeof(v));
 if(proc_pidfdinfo(getpid(),fd,PROC_PIDFDVNODEPATHINFO,&v,sizeof(v))!=(int)sizeof(v)||!memchr(v.pvip.vip_path,0,sizeof(v.pvip.vip_path)))return 0;
 char canonical[PATH_MAX];if(!realpath(v.pvip.vip_path,canonical)||strcmp(canonical,v.pvip.vip_path))return 0;
 size_t n=strlen(root);return !strncmp(canonical,root,n)&&(canonical[n]=='/'||canonical[n]==0);
}
static AxiomInventoryReport fd_snapshot(const char*root,FdSnapshot*out,size_t*count,AxiomInventoryReport r){
 struct proc_fdinfo list[AXIOM_MAX_FDS+1];int bytes=proc_pidinfo(getpid(),PROC_PIDLISTFDS,0,list,sizeof(list));
 size_t n=0;if(axiom_descriptor_count_from_bytes(bytes,&n)!=AXIOM_META_ALLOWED)return failure(r,AXIOM_META_UNKNOWN,"descriptor_inventory_incomplete");qsort(list,n,sizeof(list[0]),fd_order);
 struct stat null_stat;if(stat("/dev/null",&null_stat)||!S_ISCHR(null_stat.st_mode))return failure(r,AXIOM_META_UNKNOWN,"stdin_device_unknown");
 size_t pipes=0,kqueues=0;int stdio[3]={0,0,0};
 for(size_t i=0;i<n;i++){
  int fd=list[i].proc_fd;if(fd<0||(i&&fd==list[i-1].proc_fd))return failure(r,AXIOM_META_UNKNOWN,"descriptor_inventory_changed");
  int flags=fcntl(fd,F_GETFL);struct stat before,after;if(flags<0||fstat(fd,&before))return failure(r,AXIOM_META_UNKNOWN,"descriptor_metadata_unknown");
  int readonly=0;if(list[i].proc_fdtype==PROX_FDTYPE_VNODE&&fd>=3&&(S_ISREG(before.st_mode)||S_ISDIR(before.st_mode)))readonly=allowed_readonly_path(fd,root);
  if(fstat(fd,&after)||!same_stat(&before,&after)||fcntl(fd,F_GETFL)!=flags)return failure(r,AXIOM_META_UNKNOWN,"descriptor_metadata_changed");
  AxiomFdMetadata m={fd,list[i].proc_fdtype,flags&O_ACCMODE,1,S_ISCHR(before.st_mode)&&before.st_rdev==null_stat.st_rdev,readonly};
  AxiomMetadataDecision d=axiom_classify_fd(&m);if(d!=AXIOM_META_ALLOWED){r.descriptor_count=n;return failure(r,d,"descriptor_capability_refused");}
  if(fd<3)stdio[fd]=1;if(list[i].proc_fdtype==PROX_FDTYPE_PIPE)pipes++;if(list[i].proc_fdtype==PROX_FDTYPE_KQUEUE)kqueues++;
  if(pipes>16||kqueues>8)return failure(r,AXIOM_META_UNKNOWN,"descriptor_type_bound");
  out[i].info=list[i];out[i].flags=flags;out[i].stat=before;
 }
 if(!stdio[0]||!stdio[1]||!stdio[2])return failure(r,AXIOM_META_UNKNOWN,"stdio_incomplete");*count=n;r.descriptor_count=n;r.descriptor_scan_complete=1;return r;
}
static AxiomInventoryReport vm_snapshot(VmSnapshot*out,size_t*count,AxiomInventoryReport r){
 mach_vm_address_t address=0;natural_t depth=0;size_t n=0,steps=0;
 while(1){
  if(++steps>AXIOM_MAX_VM_REGIONS*4U||depth>64)return failure(r,AXIOM_META_UNKNOWN,"mapping_inventory_bound");
  mach_vm_size_t size=0;vm_region_submap_info_data_64_t info;memset(&info,0,sizeof(info));mach_msg_type_number_t length=VM_REGION_SUBMAP_INFO_COUNT_64;
  kern_return_t k=mach_vm_region_recurse(mach_task_self(),&address,&size,&depth,(vm_region_recurse_info_t)&info,&length);
  if(k==KERN_INVALID_ADDRESS){if(!n)return failure(r,AXIOM_META_UNKNOWN,"mapping_inventory_empty");break;}
  if(k!=KERN_SUCCESS||length!=VM_REGION_SUBMAP_INFO_COUNT_64||!size)return failure(r,AXIOM_META_UNKNOWN,"mapping_inventory_incomplete");
  if(info.is_submap){depth++;continue;}
  if(axiom_vm_leaf_progress(address,size,n)!=AXIOM_META_ALLOWED)return failure(r,AXIOM_META_UNKNOWN,"mapping_inventory_bound");
  AxiomVmMetadata m={(unsigned)info.protection,(unsigned)info.max_protection,info.share_mode,info.external_pager,1};
  AxiomMetadataDecision d=axiom_classify_vm(&m);if(d!=AXIOM_META_ALLOWED){r.region_count=n+1;r.refused_share_mode=m.share_mode;r.refused_protection=m.protection;r.refused_max_protection=m.max_protection;r.refused_external_pager=m.external_pager;return failure(r,d,"mapping_capability_refused");}
  out[n++]=(VmSnapshot){address,size,m};address+=size;
 }
 *count=n;r.region_count=n;r.region_scan_complete=1;return r;
}
AxiomInventoryReport axiom_inventory_own_process(const char*root){
 AxiomInventoryReport r={0};r.decision=AXIOM_META_ALLOWED;r.reason="metadata_shape_only";
 char canonical[PATH_MAX];if(root&&(!realpath(root,canonical)||strcmp(root,canonical)))return failure(r,AXIOM_META_UNKNOWN,"package_root_unknown");
 FdSnapshot*a=calloc(AXIOM_MAX_FDS,sizeof(*a)),*b=calloc(AXIOM_MAX_FDS,sizeof(*b));VmSnapshot*x=calloc(AXIOM_MAX_VM_REGIONS,sizeof(*x)),*y=calloc(AXIOM_MAX_VM_REGIONS,sizeof(*y));
 if(!a||!b||!x||!y){r=failure(r,AXIOM_META_UNKNOWN,"inventory_memory_bound");goto done;}
 size_t na=0,nb=0,nx=0,ny=0;r=fd_snapshot(root,a,&na,r);if(r.decision)goto done;
 r=vm_snapshot(x,&nx,r);if(r.decision)goto done;
 r=vm_snapshot(y,&ny,r);if(r.decision)goto done;
 if(nx!=ny){r=failure(r,AXIOM_META_UNKNOWN,"mapping_inventory_changed");goto done;}
 for(size_t i=0;i<nx;i++)if(x[i].address!=y[i].address||x[i].size!=y[i].size||memcmp(&x[i].metadata,&y[i].metadata,sizeof(x[i].metadata))){r=failure(r,AXIOM_META_UNKNOWN,"mapping_inventory_changed");goto done;}
 r=fd_snapshot(root,b,&nb,r);if(r.decision)goto done;
 if(na!=nb){r=failure(r,AXIOM_META_UNKNOWN,"descriptor_inventory_changed");goto done;}
 for(size_t i=0;i<na;i++)if(a[i].info.proc_fd!=b[i].info.proc_fd||a[i].info.proc_fdtype!=b[i].info.proc_fdtype||a[i].flags!=b[i].flags||!same_stat(&a[i].stat,&b[i].stat)){r=failure(r,AXIOM_META_UNKNOWN,"descriptor_inventory_changed");goto done;}
 r.stable=1;
 done:free(a);free(b);free(x);free(y);return r;
}
