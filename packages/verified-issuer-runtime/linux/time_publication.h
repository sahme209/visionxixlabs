#ifndef AXIOM_TIME_PUBLICATION_H
#define AXIOM_TIME_PUBLICATION_H
#include <stdint.h>
#include <stddef.h>
#define AXIOM_TIME_RECORD_MAX 4096u
/* Source-only Linux adapter. Context MUST come from the protected native
 * initializer, never argv, request JSON or environment. These fields identify
 * resources; they do not attest the producer or qualify its clock. */
struct axiom_time_context {
 int directory_fd;
 int source_fd; /* parent-owned O_RDONLY hold; publisher sets -1 */
 uint32_t publisher_uid, reader_gid;
 uint64_t directory_device, directory_inode;
};
struct axiom_time_capture {
 int held_fd; /* worker-owned duplicate; parent retains context.source_fd */
 size_t bytes;
 unsigned char record[AXIOM_TIME_RECORD_MAX];
 uint64_t device, inode, realtime_ns, p0_ns, p1_ns, p2_ns;
 uint64_t publication, disruption_marker;
 int time_authority; /* always zero: qualified private composition owns admission */
};
/* Fatal on every failure; cannot return through the upstream void writer. */
void axiom_time_publish_or_die(const struct axiom_time_context *, const char *, uint64_t, const unsigned char *, size_t);
int axiom_time_capture_v2(const struct axiom_time_context *, const char *, struct axiom_time_capture *);
int axiom_time_capture_current(const struct axiom_time_context *, const struct axiom_time_capture *);
void axiom_time_capture_release(struct axiom_time_capture *);
#endif
