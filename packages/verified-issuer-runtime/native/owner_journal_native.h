#ifndef AXIOM_OWNER_JOURNAL_NATIVE_H
#define AXIOM_OWNER_JOURNAL_NATIVE_H
#include "owner_journal.h"
#include <sys/types.h>
/* Compile-only fixed synthetic-root adapter. No callback is invoked by setup.
 * Produced operational binary must not be executed under preparation approval. */
typedef struct {
 int fd,dirfd,prepared,started,failed,closed;
 off_t length;
 dev_t device;
 ino_t inode;
} AxOwnerNativeJournal;
int ax_owner_native_journal_ops(AxOwnerNativeJournal *,AxOwnerJournalOps *);
#endif
