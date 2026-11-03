#define _DARWIN_C_SOURCE 1
#include <node_api.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>
#include <errno.h>
#include <stdlib.h>
static napi_value run(napi_env env,napi_callback_info info){
 size_t argc=1,n=0; napi_value args[1],out;char root[512];
 if(napi_get_cb_info(env,info,&argc,args,NULL,NULL)!=napi_ok||argc!=1||napi_get_value_string_utf8(env,args[0],root,sizeof(root),&n)!=napi_ok||n>=sizeof(root)-1||strncmp(root,"/private/tmp/axiom-preexec-owned-",sizeof("/private/tmp/axiom-preexec-owned-")-1)||strchr(root+sizeof("/private/tmp/axiom-preexec-owned-")-1,'/')){napi_throw_error(env,NULL,"fixed_owned_root_required");return NULL;}
 char path[600],shmname[96];struct stat st;if(lstat(root,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=getuid()||(st.st_mode&0777)!=0700){napi_throw_error(env,NULL,"owned_root_invalid");return NULL;}
 if(snprintf(path,sizeof(path),"%s/mapping",root)>=(int)sizeof(path)||snprintf(shmname,sizeof(shmname),"/axiom-preexec-%s",root+strlen(root)-8)>=(int)sizeof(shmname)){napi_throw_error(env,NULL,"bound");return NULL;}
 long page=sysconf(_SC_PAGESIZE);if(page<=0){napi_throw_error(env,NULL,"page_unknown");return NULL;}
 int shared_write=0,upgrade_write=0,shm_write=0,shm_created=0,cleanup_error=0;
 int fd=open(path,O_RDWR|O_NOFOLLOW|O_CLOEXEC);
 if(fd>=0){void *p=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);if(p!=MAP_FAILED){((volatile char *)p)[0]='W';shared_write=1;if(!mprotect(p,(size_t)page,PROT_READ)){close(fd);fd=-1;if(!mprotect(p,(size_t)page,PROT_READ|PROT_WRITE)){((volatile char *)p)[1]='U';upgrade_write=1;}}if(munmap(p,(size_t)page))cleanup_error=1;}if(fd>=0)close(fd);}
 int shm=shm_open(shmname,O_CREAT|O_EXCL|O_RDWR,0600);
 if(shm>=0){shm_created=1;/* unlink immediately so even a later child failure cannot persist the object */
 if(shm_unlink(shmname))cleanup_error=1;
 if(!ftruncate(shm,page)){void *p=mmap(NULL,(size_t)page,PROT_READ|PROT_WRITE,MAP_SHARED,shm,0);if(p!=MAP_FAILED){if(!mprotect(p,(size_t)page,PROT_READ)){close(shm);shm=-1;if(!mprotect(p,(size_t)page,PROT_READ|PROT_WRITE)){((volatile char *)p)[0]='S';shm_write=1;}}if(munmap(p,(size_t)page))cleanup_error=1;}}if(shm>=0)close(shm);}
 char result[256];snprintf(result,sizeof(result),"{\"shared_write\":%d,\"upgrade_write\":%d,\"shm_write\":%d,\"shm_created\":%d,\"cleanup_error\":%d}",shared_write,upgrade_write,shm_write,shm_created,cleanup_error);
 napi_create_string_utf8(env,result,NAPI_AUTO_LENGTH,&out);return out;
}
static napi_value init(napi_env env,napi_value exports){napi_value fn;if(napi_create_function(env,"run",NAPI_AUTO_LENGTH,run,NULL,&fn)!=napi_ok||napi_set_named_property(env,exports,"run",fn)!=napi_ok)return NULL;return exports;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
