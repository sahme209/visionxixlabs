/* Evaluation-only actual producer reader. Never creates publication bytes. */
#define _GNU_SOURCE
#include "time_parent_binding.h"
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>

static int opened;

static napi_value refuse(napi_env env) {
    napi_throw_error(env, NULL, "host_reader_unavailable");
    return NULL;
}

static napi_value open_host(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok ||
        argc != 0 || opened || getuid() == 0 || getgid() == 0) {
        return refuse(env);
    }
    opened = 1;

    int directory = open("/run/axiom-host-evaluation/generation-1",
                         O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    int worker = open("/opt/axiom-host-evaluation/bin/time_worker",
                      O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
    struct stat d, w;
    unsigned char magic[4];
    if (directory < 0 || worker < 0 || fstat(directory, &d) || fstat(worker, &w) ||
        !S_ISDIR(d.st_mode) || d.st_uid != 0 || d.st_gid != getgid() ||
        (d.st_mode & 07777) != 0750 || !S_ISREG(w.st_mode) || w.st_uid != 0 ||
        (w.st_mode & 0022) || pread(worker, magic, 4, 0) != 4 ||
        memcmp(magic, "\177ELF", 4)) {
        goto bad;
    }

    struct axiom_time_parent_bootstrap bootstrap = {
        .directory_fd = directory,
        .worker_elf_fd = worker,
        .publisher_uid = 0,
        .reader_gid = (uint32_t)getgid(),
        .directory_device = (uint64_t)d.st_dev,
        .directory_inode = (uint64_t)d.st_ino,
        .generation = "host-evaluation-1",
    };
    napi_value bridge;
    if (axiom_time_parent_create_private(env, &bootstrap, &bridge) != napi_ok) {
        goto bad;
    }
    int failed = 0;
    if (close(directory)) failed = 1;
    if (close(worker)) failed = 1;
    return failed ? refuse(env) : bridge;

bad:
    if (directory >= 0) close(directory);
    if (worker >= 0) close(worker);
    return refuse(env);
}

static napi_value initialize(napi_env env, napi_value exports) {
    napi_property_descriptor descriptor = {
        "openHostEvaluation", NULL, open_host, NULL, NULL, NULL, napi_default, NULL
    };
    return napi_define_properties(env, exports, 1, &descriptor) == napi_ok
        ? exports : NULL;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
