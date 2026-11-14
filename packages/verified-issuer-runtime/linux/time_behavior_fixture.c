/* TEST ONLY. Private source-bound fixture, not a production bootstrap. */
#define _GNU_SOURCE
#ifndef AXIOM_TIME_BEHAVIOR_TEST
#error Instrumented fixture requires its explicit test build
#endif
#include "time_parent_binding.h"
#include "fixture_identity.h"
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>
#include <signal.h>
#include <sys/wait.h>
#include <stdio.h>
#include <string.h>
static int used,dirs[4]={-1,-1,-1,-1};
static struct axiom_time_test_observation observations[4];
static napi_value fail(napi_env e){napi_throw_error(e,NULL,"fixture_unavailable");return NULL;}
static int no_args(napi_env e,napi_callback_info info){size_t argc=1;napi_value argv[1];if(napi_get_cb_info(e,info,&argc,argv,NULL,NULL)!=napi_ok||argc!=0)return 0;return 1;}
static int prop(napi_env e,napi_value o,const char *name,uint64_t n){napi_value v;return napi_create_bigint_uint64(e,n,&v)==napi_ok&&napi_set_named_property(e,o,name,v)==napi_ok;}
static napi_value facts(napi_env e,napi_callback_info info,unsigned index){
 if(!no_args(e,info))return fail(e);napi_value value;if(napi_create_object(e,&value)!=napi_ok)return fail(e);
 struct axiom_time_test_observation *s=&observations[index];
#define FIELD(name) if(!prop(e,value,#name,atomic_load(&s->name)))return fail(e)
 FIELD(close_attempts);FIELD(close_result);FIELD(close_operation_refs);FIELD(closed);FIELD(close_unknown);
 FIELD(cancel_at);FIELD(deadline);FIELD(reap_code);FIELD(reap_status);FIELD(owned_reap);
#undef FIELD
 if(!prop(e,value,"expectedExited",CLD_EXITED)||!prop(e,value,"expectedKilled",CLD_KILLED)||!prop(e,value,"expectedKillSignal",SIGKILL))return fail(e);
 return value;
}
static napi_value facts_success(napi_env e,napi_callback_info i){return facts(e,i,0);}
static napi_value facts_replacement(napi_env e,napi_callback_info i){return facts(e,i,1);}
static napi_value facts_foreign(napi_env e,napi_callback_info i){return facts(e,i,2);}
static napi_value facts_cancel(napi_env e,napi_callback_info i){return facts(e,i,3);}
static napi_value replace(napi_env e,napi_callback_info info){
 if(!no_args(e,info)||dirs[1]<0||renameat(dirs[1],"next",dirs[1],"current"))return fail(e);
 napi_value v;return napi_get_undefined(e,&v)==napi_ok?v:NULL;
}
static napi_value ready(napi_env e,napi_callback_info info){
 if(!no_args(e,info)||dirs[3]<0)return fail(e);int fd=openat(dirs[3],"ready",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);int yes=0;
 if(fd>=0){struct stat st;char bytes[7];ssize_t n=pread(fd,bytes,sizeof(bytes),0);
  yes=!fstat(fd,&st)&&S_ISREG(st.st_mode)&&st.st_nlink==1&&(st.st_mode&07777)==0400&&st.st_uid==getuid()&&st.st_gid==getgid()&&st.st_size==6&&n==6&&!memcmp(bytes,"ready\n",6);
  if(close(fd))return fail(e);
 }
 napi_value v;return napi_get_boolean(e,yes,&v)==napi_ok?v:NULL;
}
static napi_value cleanup(napi_env e,napi_callback_info info){
 if(!no_args(e,info))return fail(e);int bad=0;for(int i=0;i<4;i++)if(dirs[i]>=0){if(close(dirs[i]))bad=1;dirs[i]=-1;}
 if(bad)return fail(e);napi_value v;return napi_get_undefined(e,&v)==napi_ok?v:NULL;
}
static int identity(int fd,uint64_t dev,uint64_t ino,uint64_t size){struct stat st;return !fstat(fd,&st)&&S_ISREG(st.st_mode)&&st.st_uid==getuid()&&(uint64_t)st.st_dev==dev&&(uint64_t)st.st_ino==ino&&(uint64_t)st.st_size==size;}
static napi_value run(napi_env e,napi_callback_info info){
 if(!no_args(e,info)||used)return fail(e);used=1;
 int root=open(".",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC),worker=-1,stall=-1;struct stat st;
 if(root<0||fstat(root,&st)||!S_ISDIR(st.st_mode)||st.st_uid!=getuid()||(st.st_mode&07777)!=0700||(uint64_t)st.st_dev!=ROOT_DEV||(uint64_t)st.st_ino!=ROOT_INO)goto bad;
 worker=openat(root,"time_worker",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);stall=openat(root,"time_behavior_stall",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
 if(worker<0||stall<0||!identity(worker,WORKER_DEV,WORKER_INO,WORKER_SIZE)||!identity(stall,STALL_DEV,STALL_INO,STALL_SIZE))goto bad;
 const char *names[]={"success","replacement","foreign","cancel"};napi_value object;
 if(napi_create_object(e,&object)!=napi_ok)goto bad;
 for(int i=0;i<4;i++){
  dirs[i]=openat(root,names[i],O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
  if(dirs[i]<0||fstat(dirs[i],&st)||st.st_uid!=getuid()||st.st_gid!=getgid()||(st.st_mode&07777)!=0750)goto bad;
  struct axiom_time_parent_bootstrap b={.directory_fd=dirs[i],.worker_elf_fd=i==3?stall:worker,.publisher_uid=(uint32_t)getuid(),.reader_gid=(uint32_t)getgid(),.directory_device=(uint64_t)st.st_dev,.directory_inode=(uint64_t)st.st_ino,.generation="fixture-v2",.test_observation=&observations[i]};napi_value bridge;
  if(axiom_time_parent_create_private(e,&b,&bridge)!=napi_ok||napi_set_named_property(e,object,names[i],bridge)!=napi_ok)goto bad;
 }
 napi_property_descriptor methods[]={
 {"factsSuccess",NULL,facts_success,NULL,NULL,NULL,napi_default,NULL},{"factsReplacement",NULL,facts_replacement,NULL,NULL,NULL,napi_default,NULL},
 {"factsForeign",NULL,facts_foreign,NULL,NULL,NULL,napi_default,NULL},{"factsCancel",NULL,facts_cancel,NULL,NULL,NULL,napi_default,NULL},
 {"replaceCurrent",NULL,replace,NULL,NULL,NULL,napi_default,NULL},{"cancelReady",NULL,ready,NULL,NULL,NULL,napi_default,NULL},{"cleanup",NULL,cleanup,NULL,NULL,NULL,napi_default,NULL}};
 if(napi_define_properties(e,object,sizeof(methods)/sizeof(methods[0]),methods)!=napi_ok)goto bad;
 int close_failed=0;if(close(root))close_failed=1;if(close(worker))close_failed=1;if(close(stall))close_failed=1;if(close_failed)return fail(e);return object;
 bad:if(root>=0)close(root);if(worker>=0)close(worker);if(stall>=0)close(stall);for(int i=0;i<4;i++)if(dirs[i]>=0){close(dirs[i]);dirs[i]=-1;}return fail(e);
}
static napi_value initialize(napi_env e,napi_value exports){napi_property_descriptor d={"runOwnedFixture",NULL,run,NULL,NULL,NULL,napi_default,NULL};return napi_define_properties(e,exports,1,&d)==napi_ok?exports:NULL;}
NAPI_MODULE(NODE_GYP_MODULE_NAME,initialize)
