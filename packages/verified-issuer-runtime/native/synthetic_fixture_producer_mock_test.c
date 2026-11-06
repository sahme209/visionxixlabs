#define _DARWIN_C_SOURCE 1
#define AX_FIXTURE_CONTROLLER_UID 503
#define AX_FIXTURE_CONTROLLER_GID 503
#define AX_FIXTURE_FIXED_UID 504
#define AXIOM_ISSUER_CONTROL_APP AX_SYNTH_APP
#define AXIOM_ISSUER_IMAGE_BACKING AX_SYNTH_APP "/Contents/Resources/issuer-package.dmg"
#define AX_FIXTURE_NODE_SHA256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
#define AX_FIXTURE_PRODUCER_SHA256 AX_FIXTURE_NODE_SHA256
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <assert.h>
#include <spawn.h>
#define DECL(name) extern __typeof__(name) fake_##name
DECL(posix_spawn);DECL(posix_spawn_file_actions_init);DECL(posix_spawn_file_actions_destroy);DECL(posix_spawn_file_actions_adddup2);DECL(posix_spawn_file_actions_addclose);DECL(posix_spawn_file_actions_addopen);DECL(posix_spawn_file_actions_addchdir_np);DECL(posix_spawnattr_init);DECL(posix_spawnattr_destroy);DECL(posix_spawnattr_setflags);DECL(posix_spawnattr_setsigdefault);DECL(posix_spawnattr_setsigmask);DECL(open);DECL(close);DECL(read);DECL(write);DECL(fstat);DECL(fcntl);DECL(fchmod);DECL(fsync);DECL(rename);DECL(pipe);DECL(fork);DECL(poll);DECL(waitpid);DECL(kill);DECL(clock_gettime);DECL(nanosleep);DECL(sigaction);DECL(arc4random_buf);DECL(dup2);DECL(getrlimit);DECL(chdir);DECL(execve);
#define posix_spawn fake_posix_spawn
#define posix_spawn_file_actions_init fake_posix_spawn_file_actions_init
#define posix_spawn_file_actions_destroy fake_posix_spawn_file_actions_destroy
#define posix_spawn_file_actions_adddup2 fake_posix_spawn_file_actions_adddup2
#define posix_spawn_file_actions_addclose fake_posix_spawn_file_actions_addclose
#define posix_spawn_file_actions_addopen fake_posix_spawn_file_actions_addopen
#define posix_spawn_file_actions_addchdir_np fake_posix_spawn_file_actions_addchdir_np
#define posix_spawnattr_init fake_posix_spawnattr_init
#define posix_spawnattr_destroy fake_posix_spawnattr_destroy
#define posix_spawnattr_setflags fake_posix_spawnattr_setflags
#define posix_spawnattr_setsigdefault fake_posix_spawnattr_setsigdefault
#define posix_spawnattr_setsigmask fake_posix_spawnattr_setsigmask
#define open fake_open
#define close fake_close
#define read fake_read
#define write fake_write
#define fstat fake_fstat
#define fcntl fake_fcntl
#define fchmod fake_fchmod
#define fsync fake_fsync
#define rename fake_rename
#define pipe fake_pipe
#define fork fake_fork
#define poll fake_poll
#define waitpid fake_waitpid
#define kill fake_kill
#define clock_gettime fake_clock_gettime
#define nanosleep fake_nanosleep
#define sigaction(...) fake_sigaction(__VA_ARGS__)
#define arc4random_buf fake_arc4random_buf
#define dup2 fake_dup2
#define getrlimit fake_getrlimit
#define chdir fake_chdir
#define execve fake_execve
#include "origin_root_binding.h"
#include "synthetic_fixture_producer.c"
static int pipes,phase_count,alive=1,forks,reads,writes,reap_error,kills,extra,journal_records,deny_schema,root_live=1,cancel_auth,handoffs;
static unsigned char auth_bytes[AX_FIXTURE_AUTH_FRAME_MAX];static size_t auth_length,auth_read;
int axiom_origin_bind_root(AxiomOriginRootBinding*out){memset(out,0,sizeof *out);out->bound=root_live;return root_live;}int axiom_origin_root_current(const AxiomOriginRootBinding*root){return root_live&&root->bound;}int ax_fixture_maintenance_current(void){return alive;}int ax_fixture_protected_file(const char*p,int d){(void)d;const char*denied=deny_schema==1?"fixture-schema.sql":deny_schema==2?"fixture-schema.binding.json":deny_schema==3?"fixture-seed.sql":deny_schema==4?"issuer-package.dmg":"issuer-binding.plist";return !(deny_schema&&strstr(p,denied));}
int fake_open(const char*p,int flags,...){(void)flags;return strstr(p,"fixture-tools/node")||strstr(p,"fixture-producer.cjs")?10:12;}
int fake_close(int fd){(void)fd;return 0;}ssize_t fake_read(int fd,void*p,size_t n){reads++;if(fd==10)return 0;if(fd==24){if(cancel_auth){errno=ECANCELED;return -1;}if(auth_read==auth_length)return 0;size_t count=auth_length-auth_read;if(count>37)count=37;if(count>n)count=n;memcpy(p,auth_bytes+auth_read,count);auth_read+=count;return(ssize_t)count;}assert(fd==22);if(phase_count>=8){if(extra){*(unsigned char*)p=1;return 1;}return 0;}assert(n>=8);const unsigned values[]={9,10,11,12,13,14,1,2};unsigned char reply[8]={'A','X','F','S',0,0,0,(unsigned char)values[phase_count++]};memcpy(p,reply,8);return 8;}
ssize_t fake_write(int fd,const void*p,size_t n){(void)fd;if(n==8&&!memcmp(p,"AXFJ",4))journal_records++;writes++;return(ssize_t)n;}int fake_fstat(int fd,struct stat*s){(void)fd;memset(s,0,sizeof *s);s->st_ino=1;s->st_dev=1;return 0;}int fake_fcntl(int fd,int cmd,...){(void)fd;(void)cmd;return 0;}int fake_fchmod(int fd,mode_t mode){(void)fd;(void)mode;return 0;}int fake_fsync(int fd){(void)fd;return 0;}int fake_rename(const char*a,const char*b){(void)a;(void)b;return 0;}int fake_pipe(int*p){p[0]=20+pipes*2;p[1]=21+pipes*2;pipes++;return 0;}pid_t fake_fork(void){forks++;return 7;}int fake_poll(struct pollfd*p,nfds_t count,int ms){(void)ms;int ready=0;for(nfds_t i=0;i<count;i++){p[i].revents=0;if(p[i].fd<0)continue;if(p[i].fd==22&&phase_count==7&&auth_read<auth_length)continue;p[i].revents=p[i].events;ready++;}return ready;}pid_t fake_waitpid(pid_t child,int*s,int flags){(void)flags;if(reap_error){errno=ECHILD;return -1;}*s=0;return child;}int fake_kill(pid_t child,int sig){(void)child;(void)sig;kills++;return 0;}int fake_clock_gettime(clockid_t clock,struct timespec*t){(void)clock;t->tv_sec=1;t->tv_nsec=0;return 0;}int fake_nanosleep(const struct timespec*a,struct timespec*b){(void)a;(void)b;return 0;}int fake_sigaction(int sig,const struct sigaction*a,struct sigaction*b){(void)sig;(void)a;if(b){memset(b,0,sizeof *b);b->sa_handler=SIG_DFL;}return 0;}void fake_arc4random_buf(void*p,size_t n){memset(p,1,n);}int fake_dup2(int a,int b){(void)a;return b;}int fake_getrlimit(int r,struct rlimit*l){(void)r;l->rlim_cur=3;return 0;}int fake_chdir(const char*p){(void)p;return 0;}int fake_execve(const char*a,char*const*b,char*const*c){(void)a;(void)b;(void)c;return-1;}
int fake_posix_spawn(pid_t*p,const char*file,const posix_spawn_file_actions_t*a,const posix_spawnattr_t*t,char*const argv[],char*const env[]){(void)a;(void)t;assert(!strcmp(file,FIXTURE_NODE));assert(!strcmp(argv[1],PRODUCER));assert(!strcmp(env[0],"NODE_ENV=production"));forks++;*p=7;return 0;}
int fake_posix_spawn_file_actions_init(posix_spawn_file_actions_t*a){memset(a,0,sizeof *a);return 0;}int fake_posix_spawn_file_actions_destroy(posix_spawn_file_actions_t*a){(void)a;return 0;}int fake_posix_spawn_file_actions_adddup2(posix_spawn_file_actions_t*a,int f,int t){(void)a;(void)f;assert(t==0||t==1||t==3);return 0;}int fake_posix_spawn_file_actions_addclose(posix_spawn_file_actions_t*a,int f){(void)a;(void)f;return 0;}int fake_posix_spawn_file_actions_addopen(posix_spawn_file_actions_t*a,int f,const char*p,int flags,mode_t m){(void)a;(void)flags;(void)m;assert(f==2&&!strcmp(p,"/dev/null"));return 0;}int fake_posix_spawn_file_actions_addchdir_np(posix_spawn_file_actions_t*a,const char*p){(void)a;assert(!strcmp(p,AX_SYNTH_ROOT));return 0;}int fake_posix_spawnattr_init(posix_spawnattr_t*a){memset(a,0,sizeof *a);return 0;}int fake_posix_spawnattr_destroy(posix_spawnattr_t*a){(void)a;return 0;}int fake_posix_spawnattr_setflags(posix_spawnattr_t*a,short flags){(void)a;assert(flags&POSIX_SPAWN_CLOEXEC_DEFAULT);assert(flags&POSIX_SPAWN_SETSIGDEF);assert(flags&POSIX_SPAWN_SETSIGMASK);return 0;}int fake_posix_spawnattr_setsigdefault(posix_spawnattr_t*a,const sigset_t*s){(void)a;assert(sigismember(s,SIGCHLD));assert(sigismember(s,SIGPIPE));return 0;}int fake_posix_spawnattr_setsigmask(posix_spawnattr_t*a,const sigset_t*s){(void)a;assert(!sigismember(s,SIGCHLD));return 0;}
static void make_auth(void){AxFixtureAuthorization value={0};strcpy(value.requester_token,"axm.desk.dsk.qualification.requester.");memset(value.requester_token+strlen(value.requester_token),'a',64);strcpy(value.reviewer_token,"axm.desk.dsk.qualification.reviewer.");memset(value.reviewer_token+strlen(value.reviewer_token),'b',64);value.count=1;value.scenarios[0].case_id=AX_FIXTURE_READ_EXECUTION;strcpy(value.scenarios[0].request_id,"qualification_request");strcpy(value.scenarios[0].plan_id,"release_plan_");memset(value.scenarios[0].plan_id+13,'c',64);strcpy(value.scenarios[0].client_request_id,"550e8400-e29b-41d4-a716-446655440000");size_t actual=0;assert(ax_fixture_authorization_encode(&value,auth_bytes,sizeof auth_bytes,&actual));memset(auth_bytes+actual,' ',sizeof auth_bytes-actual);auth_length=sizeof auth_bytes;auth_bytes[40]=0;auth_bytes[41]=1;auth_bytes[42]=0;auth_bytes[43]=0;auth_read=0;memset(&authorization,0,sizeof authorization);authorization_valid=authorization_provisioned=authorization_consumed=0;}
int ax_fixture_controller_handoff(const unsigned char*bytes,size_t n,uint64_t deadline){assert(deadline==61000);AxFixtureAuthorization decoded;assert(ax_fixture_authorization_decode(bytes,n,&decoded));handoffs++;return 1;}
int main(void){make_auth();AxiomPrivateMaterial out;assert(ax_fixture_prepare_once(&out));assert(forks==1&&phase_count==8&&writes>2&&reads>2);assert(strstr((char*)out.datasource,"axiom_fixture_runtime:01010101"));assert(out.datasource_length>0&&out.session_length==32&&out.vault[0]==1);assert(auth_read==65580&&handoffs==0);assert(!ax_fixture_commit_and_run_controller());assert(ax_fixture_authorization_locators_published());assert(ax_fixture_commit_and_run_controller());assert(handoffs==1);assert(!ax_fixture_commit_and_run_controller());assert(journal_records>=10);assert(!ax_fixture_prepare_once(&out));assert(forks==1);atomic_flag_clear(&once);pipes=phase_count=0;make_auth();reap_error=1;assert(!ax_fixture_prepare_once(&out));assert(kills==0);atomic_flag_clear(&once);pipes=phase_count=0;make_auth();reap_error=0;extra=1;assert(!ax_fixture_prepare_once(&out));atomic_flag_clear(&once);pipes=phase_count=0;make_auth();extra=0;for(deny_schema=1;deny_schema<=5;deny_schema++){atomic_flag_clear(&once);assert(!ax_fixture_prepare_once(&out));assert(forks==3);}deny_schema=0;atomic_flag_clear(&once);root_live=0;assert(!ax_fixture_prepare_once(&out));assert(forks==3);root_live=1;atomic_flag_clear(&once);pipes=phase_count=0;make_auth();auth_length--;assert(!ax_fixture_prepare_once(&out));assert(handoffs==1);assert(!ax_fixture_authorization_locators_published());atomic_flag_clear(&once);pipes=phase_count=0;make_auth();cancel_auth=1;assert(!ax_fixture_prepare_once(&out));assert(handoffs==1);cancel_auth=0;atomic_flag_clear(&once);alive=0;assert(!ax_fixture_prepare_once(&out));assert(forks==5);return 0;}
