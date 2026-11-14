#ifndef AXIOM_TIME_WORKER_PROTOCOL_H
#define AXIOM_TIME_WORKER_PROTOCOL_H
#include "time_publication.h"
#define AXIOM_WORKER_CONTEXT_MAX 512u
#define AXIOM_WORKER_HEADER_MAX 512u
#define AXIOM_WORKER_FRAME_MAX 4608u
#define AXIOM_WORKER_GENERATION_MAX 128u
#define AXIOM_WORKER_CONTEXT_MAGIC "AXIOM_WORKER_CONTEXT_V1"
#define AXIOM_WORKER_CAPTURE_MAGIC "AXIOM_CAPTURE_V1"
struct axiom_worker_context {
 char generation[AXIOM_WORKER_GENERATION_MAX+1];
 uint32_t publisher_uid, reader_gid;
 uint64_t directory_device, directory_inode;
};
/* Exactly0 succeeds; -1 refuses. Decoders require explicit observed EOF==1,
 * clear outputs on refusal, and NEVER create/close an FD or grant authority.
 * Capture output held_fd=-1/time_authority=0. Parent validates original identity.
 * Encoders write only after full validation/capacity checks. No native ABI wire. */
int axiom_worker_record_identity(const unsigned char *,size_t,const char *,uint64_t *,uint64_t *);
int axiom_worker_context_encode(const struct axiom_worker_context *,unsigned char *,size_t,size_t *);
int axiom_worker_context_decode(const unsigned char *,size_t,int,struct axiom_worker_context *);
int axiom_worker_capture_encode(const struct axiom_worker_context *,const struct axiom_time_capture *,unsigned char *,size_t,size_t *);
int axiom_worker_capture_decode(const unsigned char *,size_t,int,const struct axiom_worker_context *,struct axiom_time_capture *);
#endif
