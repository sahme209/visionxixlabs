#define _DARWIN_C_SOURCE 1
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
#define DECL(name) extern __typeof__(name) fake_##name
DECL(open);DECL(close);DECL(read);DECL(write);DECL(fstat);DECL(fcntl);DECL(fchmod);DECL(fsync);DECL(rename);DECL(pipe);DECL(fork);DECL(poll);DECL(waitpid);DECL(kill);DECL(clock_gettime);DECL(nanosleep);DECL(sigaction);DECL(arc4random_buf);DECL(dup2);DECL(getrlimit);DECL(chdir);DECL(execve);
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
#include "synthetic_fixture_producer.c"
static int pipes,phase_count,alive=1,forks,reads,writes,reap_error,kills,extra,journal_records,deny_schema;
int ax_fixture_maintenance_current(void){return alive;}int ax_fixture_protected_file(const char*p,int d){(void)d;const char*denied=deny_schema==1?"fixture-schema.sql":deny_schema==2?"fixture-schema.binding.json":"fixture-seed.sql";return !(deny_schema&&strstr(p,denied));}
int fake_open(const char*p,int flags,...){(void)flags;return strstr(p,"fixture-tools/node")||strstr(p,"fixture-producer.cjs")?10:12;}
int fake_close(int fd){(void)fd;return 0;}ssize_t fake_read(int fd,void*p,size_t n){reads++;if(fd==10)return 0;assert(fd==22);if(n==1){if(extra){*(unsigned char*)p=1;return 1;}return 0;}assert(n==8);const unsigned values[]={9,10,11,12,13,14,1,2};assert(phase_count<8);unsigned char reply[8]={'A','X','F','S',0,0,0,(unsigned char)values[phase_count++]};memcpy(p,reply,8);return 8;}
ssize_t fake_write(int fd,const void*p,size_t n){(void)fd;if(n==8&&!memcmp(p,"AXFJ",4))journal_records++;writes++;return(ssize_t)n;}int fake_fstat(int fd,struct stat*s){(void)fd;memset(s,0,sizeof *s);s->st_ino=1;s->st_dev=1;return 0;}int fake_fcntl(int fd,int cmd,...){(void)fd;(void)cmd;return 0;}int fake_fchmod(int fd,mode_t mode){(void)fd;(void)mode;return 0;}int fake_fsync(int fd){(void)fd;return 0;}int fake_rename(const char*a,const char*b){(void)a;(void)b;return 0;}int fake_pipe(int*p){p[0]=20+pipes*2;p[1]=21+pipes*2;pipes++;return 0;}pid_t fake_fork(void){forks++;return 7;}int fake_poll(struct pollfd*p,nfds_t count,int ms){(void)count;(void)ms;p->revents=p->events;return 1;}pid_t fake_waitpid(pid_t child,int*s,int flags){(void)flags;if(reap_error){errno=ECHILD;return -1;}*s=0;return child;}int fake_kill(pid_t child,int sig){(void)child;(void)sig;kills++;return 0;}int fake_clock_gettime(clockid_t clock,struct timespec*t){(void)clock;t->tv_sec=1;t->tv_nsec=0;return 0;}int fake_nanosleep(const struct timespec*a,struct timespec*b){(void)a;(void)b;return 0;}int fake_sigaction(int sig,const struct sigaction*a,struct sigaction*b){(void)sig;(void)a;if(b){memset(b,0,sizeof *b);b->sa_handler=SIG_DFL;}return 0;}void fake_arc4random_buf(void*p,size_t n){memset(p,1,n);}int fake_dup2(int a,int b){(void)a;return b;}int fake_getrlimit(int r,struct rlimit*l){(void)r;l->rlim_cur=3;return 0;}int fake_chdir(const char*p){(void)p;return 0;}int fake_execve(const char*a,char*const*b,char*const*c){(void)a;(void)b;(void)c;return-1;}
int main(void){AxiomPrivateMaterial out;assert(ax_fixture_prepare_once(&out));assert(forks==1&&phase_count==8&&writes>2&&reads>2);assert(strstr((char*)out.datasource,"axiom_fixture_runtime:01010101"));assert(out.datasource_length>0&&out.session_length==32&&out.vault[0]==1);assert(journal_records>=10);assert(!ax_fixture_prepare_once(&out));assert(forks==1);atomic_flag_clear(&once);pipes=phase_count=0;reap_error=1;assert(!ax_fixture_prepare_once(&out));assert(kills==0);atomic_flag_clear(&once);pipes=phase_count=0;reap_error=0;extra=1;assert(!ax_fixture_prepare_once(&out));atomic_flag_clear(&once);pipes=phase_count=0;extra=0;for(deny_schema=1;deny_schema<=3;deny_schema++){atomic_flag_clear(&once);assert(!ax_fixture_prepare_once(&out));assert(forks==3);}deny_schema=0;atomic_flag_clear(&once);alive=0;assert(!ax_fixture_prepare_once(&out));assert(forks==3);return 0;}
