/* PREPARED ONLY. Execution requires the separate native-experiment approval.
 * Standalone feasibility artifact; never an addon, launcher, or identity issuer.
 * NoWrite is deprecated and does not establish network or exec restrictions.
 */
#define _DARWIN_C_SOURCE 1
#include <sandbox.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <errno.h>
#include <limits.h>

#define NOPS 12
#define CHILD_LIMIT_MS 3000
#define REPORT_MAGIC UINT32_C(0x41584e57)
static const char seed[] = "AXIOM-PROBE-ORIGINAL\n";
static const char marker = 'X';
static const char *const files[] = {"write", "truncate", "rename", "unlink",
    "chmod", "timestamp", "retained_write", "retained_truncate",
    "retained_chmod", "backing_file", "alias_target"};
static const char *const operations[NOPS] = {"create", "write", "truncate",
    "rename", "unlink", "chmod", "timestamp", "retained_write",
    "retained_truncate", "retained_chmod", "backing_file_write", "hardlink_write"};
typedef struct { int32_t rc, error; } Outcome;
typedef struct {
    uint32_t magic;
    int32_t restricted, installation, installation_errno;
    Outcome outcomes[NOPS];
} Report;
_Static_assert(sizeof(Report) <= PIPE_BUF, "child report must fit one bounded pipe write");
typedef struct { int dir, retained_write, retained_truncate, retained_chmod; } Fixture;

static int64_t milliseconds(void) {
    struct timespec t;
    if (clock_gettime(CLOCK_MONOTONIC, &t) != 0) return -1;
    return (int64_t)t.tv_sec * 1000 + t.tv_nsec / 1000000;
}
static void close_fixture(Fixture f) {
    if (f.retained_write >= 0) close(f.retained_write);
    if (f.retained_truncate >= 0) close(f.retained_truncate);
    if (f.retained_chmod >= 0) close(f.retained_chmod);
    if (f.dir >= 0) close(f.dir);
}
static int regular_owned(int fd, mode_t mode, nlink_t links) {
    struct stat s;
    return fstat(fd, &s) == 0 && S_ISREG(s.st_mode) && s.st_uid == geteuid()
        && (s.st_mode & 07777) == mode && s.st_nlink == links;
}
static Fixture prepare_fixture(const char *root, const char *label) {
    Fixture f = {-1,-1,-1,-1};
    int r = open(root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (r < 0) return f;
    struct stat s;
    if (fstat(r,&s) != 0 || !S_ISDIR(s.st_mode) || s.st_uid != geteuid()
        || (s.st_mode & 07777) != 0700 || mkdirat(r,label,0700) != 0) {
        close(r); return f;
    }
    f.dir = openat(r,label,O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    close(r);
    if (f.dir < 0) return f;
    for (size_t i=0; i<sizeof(files)/sizeof(files[0]); i++) {
        int fd = openat(f.dir,files[i],O_CREAT | O_EXCL | O_RDWR | O_NOFOLLOW | O_CLOEXEC,0600);
        const struct timespec times[2] = {{1000,0},{1000,0}};
        if (fd < 0 || !regular_owned(fd,0600,1) || write(fd,seed,sizeof(seed)-1) != sizeof(seed)-1
            || futimens(fd,times) != 0) {
            if (fd >= 0) close(fd); close_fixture(f); f.dir=-1; return f;
        }
        close(fd);
    }
    if (linkat(f.dir,"alias_target",f.dir,"backing_alias",0) != 0) {
        close_fixture(f); f.dir=-1; return f;
    }
    f.retained_write=openat(f.dir,"retained_write",O_RDWR | O_NOFOLLOW | O_CLOEXEC);
    f.retained_truncate=openat(f.dir,"retained_truncate",O_RDWR | O_NOFOLLOW | O_CLOEXEC);
    f.retained_chmod=openat(f.dir,"retained_chmod",O_RDWR | O_NOFOLLOW | O_CLOEXEC);
    if (f.retained_write<0 || f.retained_truncate<0 || f.retained_chmod<0) {
        close_fixture(f); f=(Fixture){-1,-1,-1,-1};
    }
    return f;
}
static int write_path(int dir, const char *name) {
    int fd=openat(dir,name,O_WRONLY | O_NOFOLLOW | O_CLOEXEC);
    if (fd<0) return -1;
    ssize_t n=pwrite(fd,&marker,1,0); int saved=errno; close(fd); errno=saved;
    return n==1?0:-1;
}
static void record(Outcome *o, int rc) {
    o->rc=rc==0?0:-1; o->error=rc==0?0:errno;
}
static void child_probe(Fixture f, int out, int restricted) {
    Report r; memset(&r,0,sizeof(r)); r.magic=REPORT_MAGIC; r.restricted=restricted;
    for (int i=0;i<NOPS;i++) r.outcomes[i]=(Outcome){-1,0};
    alarm(2);
    if (restricted) {
        char *error=NULL;
        int result=sandbox_init(kSBXProfileNoWrite,SANDBOX_NAMED,&error);
        int saved=errno;
        if (error != NULL) sandbox_free_error(error);
        if (result != 0) {
            r.installation=-1; r.installation_errno=saved;
            (void)write(out,&r,sizeof(r)); _exit(78);
        }
        r.installation=1;
    }
    errno=0; int fd=openat(f.dir,"create",O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC,0600);
    record(&r.outcomes[0],fd<0?-1:0); if(fd>=0)close(fd);
    errno=0; record(&r.outcomes[1],write_path(f.dir,"write"));
    errno=0; fd=openat(f.dir,"truncate",O_WRONLY | O_TRUNC | O_NOFOLLOW | O_CLOEXEC);
    record(&r.outcomes[2],fd<0?-1:0); if(fd>=0)close(fd);
    errno=0; record(&r.outcomes[3],renameat(f.dir,"rename",f.dir,"renamed"));
    errno=0; record(&r.outcomes[4],unlinkat(f.dir,"unlink",0));
    errno=0; record(&r.outcomes[5],fchmodat(f.dir,"chmod",0400,0));
    const struct timespec times[2]={{2000,0},{2000,0}};
    errno=0; record(&r.outcomes[6],utimensat(f.dir,"timestamp",times,AT_SYMLINK_NOFOLLOW));
    errno=0; ssize_t n=pwrite(f.retained_write,&marker,1,0);
    record(&r.outcomes[7],n==1?0:-1);
    errno=0; record(&r.outcomes[8],ftruncate(f.retained_truncate,0));
    errno=0; record(&r.outcomes[9],fchmod(f.retained_chmod,0400));
    errno=0; record(&r.outcomes[10],write_path(f.dir,"backing_file"));
    errno=0; record(&r.outcomes[11],write_path(f.dir,"backing_alias"));
    ssize_t sent=write(out,&r,sizeof(r));
    close(out); close_fixture(f); _exit(sent==sizeof(r)?0:74);
}
/* At most 500 one-millisecond polls per phase; never an unbounded waitpid.
 * Failure remains explicitly unknown: it does not assert that no child remains. */
static int reap_bounded(pid_t child, int *status, int terminate) {
    if (terminate && kill(child,SIGKILL) != 0 && errno != ESRCH) return 0;
    for (int i=0;i<500;i++) {
        pid_t got=waitpid(child,status,WNOHANG);
        if (got==child) return 1;
        if (got<0 && errno!=EINTR) return 0;
        struct timespec pause={0,1000000}; (void)nanosleep(&pause,NULL);
    }
    return 0;
}
static int run_child(Fixture f, int restricted, Report *report) {
    int pipefd[2]; if(pipe(pipefd)!=0)return -1;
    if(fcntl(pipefd[0],F_SETFL,O_NONBLOCK)<0){close(pipefd[0]);close(pipefd[1]);return -1;}
    pid_t child=fork();
    if(child<0){close(pipefd[0]);close(pipefd[1]);return -1;}
    if(child==0){close(pipefd[0]);child_probe(f,pipefd[1],restricted);}
    close(pipefd[1]);
    int64_t start=milliseconds(); size_t used=0; int status=0, reaped=0;
    if(start<0){int reaped_after_kill=reap_bounded(child,&status,1);close(pipefd[0]);return reaped_after_kill?-1:-2;}
    while(used<sizeof(*report)) {
        int64_t now=milliseconds(); if(now<start || now-start>=CHILD_LIMIT_MS)break;
        struct pollfd p={pipefd[0],POLLIN,0};
        int ready=poll(&p,1,(int)(CHILD_LIMIT_MS-(now-start)));
        if(ready<0){if(errno==EINTR)continue;break;}
        if(ready==0)break;
        ssize_t n=read(pipefd[0],(char*)report+used,sizeof(*report)-used);
        if(n>0){used+=(size_t)n;continue;}
        if(n<0&&(errno==EINTR||errno==EAGAIN))continue;
        break;
    }
    close(pipefd[0]);
    reaped=reap_bounded(child,&status,used!=sizeof(*report));
    if(!reaped)reaped=reap_bounded(child,&status,1);
    if(!reaped)return -2;
    if(!reaped||used!=sizeof(*report)||!WIFEXITED(status)||report->magic!=REPORT_MAGIC
        ||report->restricted!=restricted)return -1;
    if(restricted&&report->installation==-1)return WEXITSTATUS(status)==78?78:-1;
    return WEXITSTATUS(status)==0?0:-1;
}
static int missing(int dir,const char *name){struct stat s;errno=0;return fstatat(dir,name,&s,AT_SYMLINK_NOFOLLOW)<0&&errno==ENOENT;}
static int check_file(int dir,const char *name,int changed,int empty,mode_t mode,nlink_t links) {
    int fd=openat(dir,name,O_RDONLY | O_NOFOLLOW | O_CLOEXEC); if(fd<0)return 0;
    char bytes[sizeof(seed)+1];memset(bytes,0,sizeof(bytes));ssize_t n=pread(fd,bytes,sizeof(bytes),0);
    int ok=regular_owned(fd,mode,links);
    if(empty)ok=ok&&n==0;
    else {char expected[sizeof(seed)];memcpy(expected,seed,sizeof(seed));if(changed)expected[0]=marker;ok=ok&&n==sizeof(seed)-1&&memcmp(bytes,expected,sizeof(seed)-1)==0;}
    close(fd);return ok;
}
static int verify_fixture(Fixture f,int changed) {
    struct stat timestamp,created;
    int ok=changed?(fstatat(f.dir,"create",&created,AT_SYMLINK_NOFOLLOW)==0&&S_ISREG(created.st_mode)&&created.st_uid==geteuid()&&(created.st_mode&07777)==0600&&created.st_size==0):missing(f.dir,"create");
    ok=ok&&check_file(f.dir,"write",changed,0,0600,1)&&check_file(f.dir,"truncate",0,changed,0600,1);
    ok=ok&&check_file(f.dir,changed?"renamed":"rename",0,0,0600,1)&&missing(f.dir,changed?"rename":"renamed");
    ok=ok&&(changed?missing(f.dir,"unlink"):check_file(f.dir,"unlink",0,0,0600,1));
    ok=ok&&check_file(f.dir,"chmod",0,0,changed?0400:0600,1)&&check_file(f.dir,"retained_chmod",0,0,changed?0400:0600,1);
    ok=ok&&check_file(f.dir,"retained_write",changed,0,0600,1)&&check_file(f.dir,"retained_truncate",0,changed,0600,1);
    ok=ok&&check_file(f.dir,"backing_file",changed,0,0600,1)&&check_file(f.dir,"alias_target",changed,0,0600,2)&&check_file(f.dir,"backing_alias",changed,0,0600,2);
    ok=ok&&check_file(f.dir,"timestamp",0,0,0600,1)&&fstatat(f.dir,"timestamp",&timestamp,AT_SYMLINK_NOFOLLOW)==0&&timestamp.st_mtimespec.tv_sec==(changed?2000:1000)&&timestamp.st_mtimespec.tv_nsec==0;
    return ok;
}
int main(int argc,char **argv) {
    if(argc!=2||strcmp(argv[1],"--owned-temp-fixture-run")!=0){fputs("probe_not_run: explicit reviewed argument required\n",stderr);return 64;}
    umask(077);
    char root[]="/private/tmp/axiom-nowrite-probe-XXXXXXXX";
    if(mkdtemp(root)==NULL){fputs("fixture_unavailable\n",stderr);return 74;}
    printf("fixture=%s\n",root);fflush(stdout);
    int failed=0;
    for(int restricted=0;restricted<2;restricted++) {
        Fixture f=prepare_fixture(root,restricted?"restricted":"control");
        if(f.dir<0){fputs("fixture_unavailable\n",stderr);return 74;}
        Report r;memset(&r,0,sizeof(r));int status=run_child(f,restricted,&r);
        if(status!=0){if(status==-2)fputs("supervisor_owned_child_unreaped_unknown\n",stderr);printf("case=%s installation=%d errno=%d status=%d\n",restricted?"restricted":"control",r.installation,r.installation_errno,status);close_fixture(f);return status==78?78:74;}
        for(int op=0;op<NOPS;op++) {
            int valid=restricted?(r.outcomes[op].rc==-1&&(r.outcomes[op].error==EPERM||r.outcomes[op].error==EACCES)):r.outcomes[op].rc==0;
            printf("case=%s operation=%s rc=%d errno=%d expected=%d\n",restricted?"restricted":"control",operations[op],r.outcomes[op].rc,r.outcomes[op].error,valid);
            if(!valid)failed=1;
        }
        int verified=verify_fixture(f,!restricted);printf("case=%s parent_file_comparison=%d\n",restricted?"restricted":"control",verified);if(!verified)failed=1;close_fixture(f);
    }
    puts(failed?"native_sandbox_profile_unsupported":"owned_fixture_nowrite_feasibility_only; no_identity_no_mount_or_compiled_consumer_acceptance");
    return failed?78:0;
}
