#define _GNU_SOURCE
#include "time_operational_binding.h"
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/xattr.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <time.h>
#include <pthread.h>
#include <stdbool.h>

struct original_sample;
struct operational {
 napi_env env;pthread_mutex_t lock;unsigned refs;int retired,busy,invocation,request_fd,response_fd,acceptance_fd;struct stat acceptance_stat;unsigned char acceptance_bytes[4096];size_t acceptance_length;
 uint64_t sequence,last_time,last_mono,last_publication,invocation_deadline;
 struct axiom_operational_acceptance acceptance;
 napi_ref raw,context;struct original_sample *active;
};
struct original_sample {
 struct operational *owner;struct axiom_time_original *original;
 uint64_t realtime,before,after,publication,marker,deadline;
 struct axiom_operational_status status;int consumed;
};
struct task {
 struct operational *owner;struct original_sample *sample;
 napi_async_work work;napi_deferred deferred;napi_ref argument;
 int current,success;
};
static int initialized;
static const napi_type_tag sample_tag={0x1fb3dc7d319f4103ULL,0xb61d839b037b13a5ULL};
static napi_value unavailable(napi_env e){napi_value text,error;if(napi_create_string_utf8(e,"operational_time_unavailable",NAPI_AUTO_LENGTH,&text)!=napi_ok||napi_create_error(e,NULL,text,&error)!=napi_ok)return NULL;return error;}
static napi_value refuse(napi_env e){napi_value err=unavailable(e);if(err)napi_throw(e,err);return NULL;}
static void ref(struct operational *o){pthread_mutex_lock(&o->lock);o->refs++;pthread_mutex_unlock(&o->lock);}
static void unref(struct operational *o){pthread_mutex_lock(&o->lock);int done=!--o->refs;pthread_mutex_unlock(&o->lock);if(done){close(o->request_fd);close(o->response_fd);close(o->acceptance_fd);if(o->raw)napi_delete_reference(o->env,o->raw);if(o->context)napi_delete_reference(o->env,o->context);pthread_mutex_destroy(&o->lock);free(o);}}
static int live(struct operational *o){pthread_mutex_lock(&o->lock);int ok=!o->retired;pthread_mutex_unlock(&o->lock);return ok;}
static void retire_native(struct operational *o){pthread_mutex_lock(&o->lock);o->retired=1;o->invocation=0;pthread_mutex_unlock(&o->lock);}
static void dispose_sample(struct original_sample *s){if(s->original){axiom_time_parent_unpin_original(s->original);s->original=NULL;}}
static void sample_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;struct original_sample*s=data;if(s->owner->active==s)s->owner->active=NULL;dispose_sample(s);unref(s->owner);free(s);}
static void owner_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;retire_native(data);unref(data);}
static void method_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;unref(data);}
static int realtime(uint64_t*v){struct timespec t;if(clock_gettime(CLOCK_REALTIME,&t)||t.tv_sec<0||t.tv_nsec<0||t.tv_nsec>=1000000000||(uint64_t)t.tv_sec>((uint64_t)INT64_MAX-(uint64_t)t.tv_nsec)/1000000000)return -1;*v=(uint64_t)t.tv_sec*1000000000+(uint64_t)t.tv_nsec;return 0;}
static int check_owner(struct operational *o,struct original_sample*s,struct axiom_operational_status*reply,uint64_t deadline){
 struct stat held;unsigned char record[4097];
 if(fstat(o->acceptance_fd,&held)||held.st_dev!=o->acceptance_stat.st_dev||held.st_ino!=o->acceptance_stat.st_ino||held.st_size!=(off_t)o->acceptance_length||held.st_mode!=o->acceptance_stat.st_mode||held.st_uid!=0||held.st_ctim.tv_sec!=o->acceptance_stat.st_ctim.tv_sec||held.st_ctim.tv_nsec!=o->acceptance_stat.st_ctim.tv_nsec||pread(o->acceptance_fd,record,sizeof record,0)!=(ssize_t)o->acceptance_length||memcmp(record,o->acceptance_bytes,o->acceptance_length)||!live(o)||o->sequence==UINT64_MAX)return -1;
 struct axiom_operational_status q={0};q.sequence=++o->sequence;q.revision=o->acceptance.revision;q.publication=s->publication;q.marker=s->marker;q.state=AXIOM_OP_READY;
 memcpy(q.profile,o->acceptance.profile,sizeof q.profile);memcpy(q.host,o->acceptance.host,sizeof q.host);memcpy(q.source_generation,o->acceptance.source_generation,sizeof q.source_generation);
 if(axiom_operational_exchange(o->request_fd,o->response_fd,&q,reply,deadline)||!live(o))return -1;return 0;
}
static int sample_original(struct operational *o,struct original_sample*s,uint64_t deadline){
 /* axiom_time_parent_pin_original authenticated this original tag/hold before
  * queueing; no field from the JS summary is used as a native resource. */
 struct axiom_operational_status before,after;
 if(check_owner(o,s,&before,deadline)||axiom_time_parent_original_current(s->original))return -1;
 if(axiom_operational_monotonic(&s->before)||realtime(&s->realtime)||axiom_operational_monotonic(&s->after)||s->before>s->after||s->before<o->last_mono||s->realtime<o->last_time||s->publication<o->last_publication)return -1;
 if(check_owner(o,s,&after,deadline)||!axiom_operational_same(&before,&after)||axiom_time_parent_original_current(s->original))return -1;
 s->status=after;o->last_time=s->realtime;o->last_mono=s->after;o->last_publication=s->publication;return 0;
}
static void execute(napi_env e,void*data){
 (void)e;struct task*t=data;uint64_t now;if(axiom_operational_monotonic(&now)||now>=t->sample->deadline){retire_native(t->owner);return;}
 uint64_t deadline=t->sample->deadline;
 if(!t->current)t->success=sample_original(t->owner,t->sample,deadline)==0;
 else {struct axiom_operational_status status;t->success=live(t->owner)&&t->sample->original&&!axiom_time_parent_original_current(t->sample->original)&&!check_owner(t->owner,t->sample,&status,deadline)&&axiom_operational_same(&status,&t->sample->status)&&!axiom_time_parent_original_current(t->sample->original);}
 /* Final owned facts may themselves await native work; preserve the SAME
  * original deadline at execute exit, without claiming pause-free dispatch. */
 uint64_t finished;if(axiom_operational_monotonic(&finished)||finished>=t->sample->deadline)t->success=0;
 if(!t->success)retire_native(t->owner);
}
static int bigint(napi_env e,napi_value out,const char*k,uint64_t n){napi_value v;return napi_create_bigint_uint64(e,n,&v)==napi_ok&&napi_set_named_property(e,out,k,v)==napi_ok;}
static void complete(napi_env e,napi_status status,void*data){
 struct task*t=data;napi_value out=NULL;struct operational*o=t->owner;
 /* N-API delivery can be delayed after execute returned. Do not promote a
  * queued, expired result into an authentic operational observation. */
 uint64_t delivered;if(axiom_operational_monotonic(&delivered)||delivered>=t->sample->deadline||status!=napi_ok||!live(o))t->success=0;
 if(t->success&&!t->current){
  napi_value context;struct original_sample*s=t->sample;
  if(napi_create_object(e,&out)!=napi_ok||napi_get_reference_value(e,o->context,&context)!=napi_ok||napi_set_named_property(e,out,"context",context)!=napi_ok||!bigint(e,out,"unixTimeNs",s->realtime)||!bigint(e,out,"monotonicBeforeNs",s->before)||!bigint(e,out,"monotonicAfterNs",s->after)||!bigint(e,out,"publication",s->publication)||!bigint(e,out,"disruptionMarker",s->marker)||napi_type_tag_object(e,out,&sample_tag)!=napi_ok||napi_object_freeze(e,out)!=napi_ok||napi_wrap(e,out,s,sample_finalizer,NULL,NULL)!=napi_ok)t->success=0;
 }
 if(t->current||!t->success){if(o->active==t->sample)o->active=NULL;dispose_sample(t->sample);}else o->active=t->sample;
 if(t->success){if(t->current)napi_get_undefined(e,&out);napi_resolve_deferred(e,t->deferred,out);}
 else {retire_native(o);napi_reject_deferred(e,t->deferred,unavailable(e));}
 if(!t->current&&!t->success){unref(o);free(t->sample);}
 pthread_mutex_lock(&o->lock);o->busy=0;if(t->current&&t->success)o->invocation=0;pthread_mutex_unlock(&o->lock);
 if(t->argument)napi_delete_reference(e,t->argument);napi_delete_async_work(e,t->work);unref(o);free(t);
}
/* Synchronous, no-argument private invocation boundary. Called by the fixed
 * trusted wrapper BEFORE raw hold; not a caller-selected deadline or grant. */
static napi_value begin_cb(napi_env e,napi_callback_info info){
 size_t argc=1;napi_value args[1],self,out;void*data=NULL;
 if(napi_get_cb_info(e,info,&argc,args,&self,&data)!=napi_ok||argc||!data)return refuse(e);
 struct operational*o=data;uint64_t now;
 if(axiom_operational_monotonic(&now)||now>UINT64_MAX-AXIOM_OPERATIONAL_DEADLINE_NS){retire_native(o);return refuse(e);}
 pthread_mutex_lock(&o->lock);
 int ok=!o->retired&&!o->busy&&!o->active&&!o->invocation;
 if(ok){o->invocation=1;o->invocation_deadline=now+AXIOM_OPERATIONAL_DEADLINE_NS;}
 pthread_mutex_unlock(&o->lock);
 if(!ok){retire_native(o);return refuse(e);}
 if(napi_get_undefined(e,&out)!=napi_ok){retire_native(o);return refuse(e);}return out;
}
static napi_value queue(napi_env e,napi_callback_info info,int current){
 size_t argc=3;napi_value args[3],self,out,name,raw;void*data=NULL;
 if(napi_get_cb_info(e,info,&argc,args,&self,&data)!=napi_ok||!data)return refuse(e);struct operational*o=data;
 struct original_sample*s=NULL;bool tag=false;
 pthread_mutex_lock(&o->lock);int invocation=o->invocation;uint64_t invocation_deadline=o->invocation_deadline;pthread_mutex_unlock(&o->lock);
 uint64_t now;if(!invocation||axiom_operational_monotonic(&now)||now>=invocation_deadline){retire_native(o);return refuse(e);}
 if(current){if(argc<1||napi_check_object_type_tag(e,args[0],&sample_tag,&tag)!=napi_ok||!tag||napi_unwrap(e,args[0],(void**)&s)!=napi_ok||!s||s->owner!=o||s->consumed)return refuse(e);}
 else {if(argc<2)return refuse(e);s=calloc(1,sizeof*s);if(!s)return refuse(e);s->owner=o;
 if(napi_get_reference_value(e,o->raw,&raw)!=napi_ok||axiom_time_parent_pin_original(e,raw,args[0],args[1],&s->original,&s->publication,&s->marker,&s->deadline)){free(s);return refuse(e);}if(s->deadline>invocation_deadline)s->deadline=invocation_deadline;ref(o);}
 pthread_mutex_lock(&o->lock);int ok=!o->retired&&!o->busy&&(current||!o->active);if(ok)o->busy=1;pthread_mutex_unlock(&o->lock);
 if(!ok){if(!current){dispose_sample(s);unref(o);free(s);}return refuse(e);}
 struct task*t=calloc(1,sizeof*t);if(!t)goto bad;t->owner=o;t->sample=s;t->current=current;
 if(napi_create_promise(e,&t->deferred,&out)!=napi_ok||napi_create_string_utf8(e,"axiom-operational-time",NAPI_AUTO_LENGTH,&name)!=napi_ok||(current&&napi_create_reference(e,args[0],1,&t->argument)!=napi_ok)||napi_create_async_work(e,NULL,name,execute,complete,t,&t->work)!=napi_ok)goto bad;
 ref(o);if(napi_queue_async_work(e,t->work)!=napi_ok){unref(o);goto bad;}if(current)s->consumed=1;return out;
 bad:retire_native(o);pthread_mutex_lock(&o->lock);o->busy=0;pthread_mutex_unlock(&o->lock);if(t){if(t->argument)napi_delete_reference(e,t->argument);if(t->work)napi_delete_async_work(e,t->work);free(t);}if(!current){dispose_sample(s);unref(o);free(s);}return refuse(e);
}
static napi_value sample_cb(napi_env e,napi_callback_info i){return queue(e,i,0);}
static napi_value current_cb(napi_env e,napi_callback_info i){return queue(e,i,1);}
static napi_value retire_cb(napi_env e,napi_callback_info i){size_t argc=0;void*data=NULL;napi_value self,out,raw,method;if(napi_get_cb_info(e,i,&argc,NULL,&self,&data)!=napi_ok||!data)return refuse(e);struct operational*o=data;retire_native(o);pthread_mutex_lock(&o->lock);int busy=o->busy;pthread_mutex_unlock(&o->lock);if(!busy&&o->active){o->active->consumed=1;dispose_sample(o->active);o->active=NULL;}if(napi_get_reference_value(e,o->raw,&raw)!=napi_ok||napi_get_named_property(e,raw,"retire",&method)!=napi_ok||napi_call_function(e,raw,method,0,NULL,&out)!=napi_ok)return refuse(e);napi_get_undefined(e,&out);return out;}
static int descriptor(int fd,int kind,int access){struct stat s;int flags=fcntl(fd,F_GETFL);return flags>=0&&(flags&O_ACCMODE)==access&&!fstat(fd,&s)&&(kind?S_ISFIFO(s.st_mode):S_ISREG(s.st_mode))&&s.st_uid==0;}
static int no_acl(int fd){errno=0;return fgetxattr(fd,"system.posix_acl_access",NULL,0)<0&&errno==ENODATA;}
static int string(napi_env e,napi_value out,const char*k,const char*s){napi_value v;return napi_create_string_utf8(e,s,NAPI_AUTO_LENGTH,&v)==napi_ok&&napi_set_named_property(e,out,k,v)==napi_ok;}
napi_status axiom_time_operational_create_private(napi_env e,const struct axiom_time_parent_bootstrap*b,napi_value*out){
 if(initialized++||!b||!out||getuid()==0||getgid()==0||!descriptor(8,0,O_RDONLY)||!descriptor(9,1,O_WRONLY)||!descriptor(10,1,O_RDONLY))return napi_generic_failure;
 char boot[129]={0};int bootfd=open("/proc/sys/kernel/random/boot_id",O_RDONLY|O_CLOEXEC|O_NOFOLLOW);ssize_t bootlen=bootfd>=0?read(bootfd,boot,sizeof boot-1):-1;if(bootfd>=0)close(bootfd);if(bootlen<2||boot[bootlen-1]!='\n')return napi_generic_failure;boot[bootlen-1]=0;
 struct stat st;if(fstat(8,&st)||st.st_nlink!=1||(st.st_mode&07777)!=0440||st.st_size<1||st.st_size>4096||!no_acl(8))return napi_generic_failure;
 unsigned char bytes[4097];ssize_t n=pread(8,bytes,sizeof bytes,0);struct axiom_operational_acceptance a;
 if(n!=st.st_size||axiom_operational_accept_decode(bytes,(size_t)n,&a)||strcmp(a.boot,boot)||a.directory_device!=b->directory_device||a.directory_inode!=b->directory_inode||a.reader_gid!=getgid()||a.reader_gid!=b->reader_gid||a.publisher_uid!=b->publisher_uid||strcmp(a.source_generation,b->generation))return napi_generic_failure;
 struct operational*o=calloc(1,sizeof*o);if(!o)return napi_generic_failure;o->env=e;o->refs=1;o->request_fd=-1;o->response_fd=-1;o->acceptance_fd=-1;o->acceptance=a;o->acceptance_stat=st;o->acceptance_length=(size_t)n;memcpy(o->acceptance_bytes,bytes,(size_t)n);
 if(pthread_mutex_init(&o->lock,NULL)){free(o);return napi_generic_failure;}
 o->acceptance_fd=fcntl(8,F_DUPFD_CLOEXEC,16);o->request_fd=fcntl(9,F_DUPFD_CLOEXEC,16);o->response_fd=fcntl(10,F_DUPFD_CLOEXEC,16);
 if(o->acceptance_fd<0||o->request_fd<0||o->response_fd<0)goto bad;
 if(close(8)||close(9)||close(10))goto bad;
 if(fcntl(o->request_fd,F_SETFL,O_NONBLOCK)||fcntl(o->response_fd,F_SETFL,O_NONBLOCK))goto bad;
 napi_value raw,context,revision;
 if(axiom_time_parent_create_private(e,b,&raw)!=napi_ok||napi_create_reference(e,raw,1,&o->raw)!=napi_ok||napi_create_object(e,&context)!=napi_ok||!string(e,context,"profileDigest",a.profile)||!string(e,context,"hostGeneration",a.host)||!string(e,context,"sourceGeneration",a.source_generation)||!string(e,context,"source","amazon-ipv4-ntp")||a.revision>9007199254740991ULL||napi_create_double(e,(double)a.revision,&revision)!=napi_ok||napi_set_named_property(e,context,"revision",revision)!=napi_ok||napi_object_freeze(e,context)!=napi_ok||napi_create_reference(e,context,1,&o->context)!=napi_ok||napi_create_object(e,out)!=napi_ok||napi_set_named_property(e,*out,"context",context)!=napi_ok||napi_set_named_property(e,*out,"raw",raw)!=napi_ok)goto bad;
 napi_property_descriptor methods[]={{"beginObservation",NULL,begin_cb,NULL,NULL,NULL,napi_default,o},{"sampleOriginal",NULL,sample_cb,NULL,NULL,NULL,napi_default,o},{"assertObservationCurrent",NULL,current_cb,NULL,NULL,NULL,napi_default,o},{"retire",NULL,retire_cb,NULL,NULL,NULL,napi_default,o}};
 if(napi_define_properties(e,*out,4,methods)!=napi_ok||napi_wrap(e,*out,o,owner_finalizer,NULL,NULL)!=napi_ok)goto bad;
 const char*names[]={"beginObservation","sampleOriginal","assertObservationCurrent","retire"};for(size_t i=0;i<4;i++){napi_value fn;if(napi_get_named_property(e,*out,names[i],&fn)!=napi_ok)return napi_generic_failure;ref(o);if(napi_add_finalizer(e,fn,o,method_finalizer,NULL,NULL)!=napi_ok){unref(o);return napi_generic_failure;}}
 return napi_ok;
 bad:retire_native(o);unref(o);return napi_generic_failure;
}

/* Sole module initialization. No JS factory, path, FD or acceptance selector.
 * The parent administrative package delivers originals FD3/4/8/9/10. */
static napi_value initialize_operational(napi_env e,napi_value exports){
 (void)exports;struct stat d,w,nd,nw,a;unsigned char bytes[4097],magic[4];
 struct axiom_operational_acceptance accepted;
 int df=fcntl(3,F_GETFL),wf=fcntl(4,F_GETFL);
 if(df<0||wf<0||(df&O_ACCMODE)!=O_RDONLY||(wf&O_ACCMODE)!=O_RDONLY||fstat(3,&d)||fstat(4,&w)||fstat(8,&a)||!S_ISDIR(d.st_mode)||!S_ISREG(w.st_mode)||d.st_uid!=0||w.st_uid!=0||(d.st_mode&07777)!=0750||(w.st_mode&0022)||w.st_nlink!=1||!no_acl(3)||!no_acl(4)||lstat("/run/axiom-operational-time/generation-1",&nd)||lstat("/opt/axiom-operational-time/bin/time_worker",&nw)||nd.st_dev!=d.st_dev||nd.st_ino!=d.st_ino||nw.st_dev!=w.st_dev||nw.st_ino!=w.st_ino||pread(4,magic,4,0)!=4||memcmp(magic,"\177ELF",4))return refuse(e);
 ssize_t n=pread(8,bytes,sizeof bytes,0);if(n<1||n>4096||n!=a.st_size||axiom_operational_accept_decode(bytes,(size_t)n,&accepted))return refuse(e);
 struct axiom_time_parent_bootstrap bootstrap={.directory_fd=3,.worker_elf_fd=4,.publisher_uid=0,.reader_gid=(uint32_t)accepted.reader_gid,.directory_device=(uint64_t)d.st_dev,.directory_inode=(uint64_t)d.st_ino,.generation=accepted.source_generation};
 napi_value bridge;if(axiom_time_operational_create_private(e,&bootstrap,&bridge)!=napi_ok)return refuse(e);
 if(close(3)||close(4))return refuse(e);return bridge;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,initialize_operational)
