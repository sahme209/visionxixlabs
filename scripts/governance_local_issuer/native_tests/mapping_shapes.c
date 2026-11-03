#define _DARWIN_C_SOURCE 1
#include "capability_inventory.h"
#include <mach/mach.h>
#include <mach/mach_vm.h>
#include <mach/vm_region.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <libproc.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
static int leaf(mach_vm_address_t *a,mach_vm_size_t *s,vm_region_submap_info_data_64_t *i){
 natural_t depth=0;for(unsigned n=0;n<64;n++){mach_msg_type_number_t c=VM_REGION_SUBMAP_INFO_COUNT_64;memset(i,0,sizeof(*i));kern_return_t k=mach_vm_region_recurse(mach_task_self(),a,s,&depth,(vm_region_recurse_info_t)i,&c);if(k!=KERN_SUCCESS||c!=VM_REGION_SUBMAP_INFO_COUNT_64||!*s)return 0;if(!i->is_submap)return 1;depth++;}return 0;
}
static void emit(const char *label,mach_vm_address_t a,const vm_region_submap_info_data_64_t *i){
 char p[4096];int named=proc_regionfilename(getpid(),a,p,sizeof(p))>0;
 AxiomVmMetadata m={(unsigned)i->protection,(unsigned)i->max_protection,i->share_mode,i->external_pager,1};
 printf("%s decision=%d prot=%u max=%u share=%u external=%u submap=%u tag=%u inherit=%u shadow=%u resident=%u private_pages=%u refs=%u offset_zero=%d object_present=%d named=%d\n",label,axiom_classify_vm(&m),(unsigned)i->protection,(unsigned)i->max_protection,i->share_mode,i->external_pager,(unsigned)i->is_submap,i->user_tag,(unsigned)i->inheritance,i->shadow_depth,i->pages_resident,i->pages_shared_now_private,i->ref_count,i->offset==0,i->object_id_full!=0,named);
}
static int inspect(const char *label,void *p){mach_vm_address_t wanted=(uintptr_t)p,a=wanted;mach_vm_size_t s=0;vm_region_submap_info_data_64_t i;if(!leaf(&a,&s,&i)||a>wanted||s<=wanted-a)return 0;emit(label,a,&i);return 1;}
int main(void){
 mach_vm_address_t a=0;mach_vm_size_t s=0;vm_region_submap_info_data_64_t i;int found=0;
 for(unsigned n=0;n<AXIOM_MAX_VM_REGIONS;n++){if(!leaf(&a,&s,&i)||a>UINT64_MAX-s)return 2;AxiomVmMetadata m={(unsigned)i.protection,(unsigned)i.max_protection,i.share_mode,i.external_pager,1};if(axiom_classify_vm(&m)!=AXIOM_META_ALLOWED){emit("baseline_first_refusal",a,&i);found=1;break;}a+=s;}if(!found)return 3;
 char dir[]="/private/tmp/axiom-vm-shape-XXXXXXXX";if(!mkdtemp(dir)||chmod(dir,0700))return 4;char path[512];if(snprintf(path,sizeof(path),"%s/owned",dir)>=(int)sizeof(path))return 5;
 int fd=open(path,O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC|O_RDWR,0600);long page=sysconf(_SC_PAGESIZE);if(fd<0||page<=0||ftruncate(fd,page))return 6;
 void *shared=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);if(shared==MAP_FAILED||mprotect(shared,(size_t)page,PROT_READ))return 7;if(close(fd))return 8;
 int ok=inspect("file_shared_ro_fd_closed",shared);
 /* Reading only our own seeded mapping faults it without changing bytes. */
 volatile unsigned char value=*(volatile unsigned char *)shared;(void)value;
 ok=inspect("file_shared_ro_faulted",shared)&&ok;
 fd=open(path,O_NOFOLLOW|O_CLOEXEC|O_RDWR);if(fd<0)return 11;
 void *alias=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);
 void *cow=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_PRIVATE,fd,0);
 if(alias==MAP_FAILED||cow==MAP_FAILED||close(fd))return 12;
 ok=inspect("file_shared_alias",alias)&&inspect("file_private_cow",cow)&&inspect("file_shared_with_alias",shared)&&ok;
 void *anon=mmap(NULL,(size_t)page,PROT_NONE,MAP_ANON|MAP_SHARED,-1,0);
 void *guard=mmap(NULL,(size_t)page,PROT_NONE,MAP_ANON|MAP_PRIVATE,-1,0);
 if(anon==MAP_FAILED||guard==MAP_FAILED)return 13;
 ok=inspect("anonymous_shared_none",anon)&&inspect("private_guard_none",guard)&&ok;
 char shmname[96];if(snprintf(shmname,sizeof(shmname),"/axiom-vm-%s",dir+strlen(dir)-8)>=(int)sizeof(shmname))return 14;
 int shm=shm_open(shmname,O_CREAT|O_EXCL|O_RDWR,0600);if(shm<0)return 15;
 if(shm_unlink(shmname)||ftruncate(shm,page))return 16;
 void *shmap=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_SHARED,shm,0);
 if(shmap==MAP_FAILED||mprotect(shmap,(size_t)page,PROT_READ)||close(shm))return 17;
 ok=inspect("owned_posix_shm_ro_fd_closed",shmap)&&ok;
 if(munmap(shmap,(size_t)page))return 18;
 if(munmap(alias,(size_t)page)||munmap(cow,(size_t)page)||munmap(anon,(size_t)page)||munmap(guard,(size_t)page)||munmap(shared,(size_t)page)||unlink(path)||rmdir(dir))return 9;puts("qualification=diagnostic_only identity=unavailable profile_executed=0");return ok?0:10;
}
