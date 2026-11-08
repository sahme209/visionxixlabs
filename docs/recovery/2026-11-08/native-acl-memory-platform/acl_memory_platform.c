/* One fixed in-memory macOS ACL qualification (PROPOSAL.md sha256 09139ec5...).
 * Exercises the UNCHANGED production helper ax_acl_is_empty() against five real
 * memory-only ACL subjects. No file/fd/link ACL API, no text conversion, no
 * principal lookup, no acl_valid*, no acl_get_entry. All data is synthetic.
 * Output: one fixed PASS line, or one fixed "FAIL case=<n> status=<n>" line. */
#include "protected_acl_empty.h"
#include <stdio.h>

enum ax_case { C_E0 = 1, C_E1 = 2, C_ED = 3, C_A = 4, C_D = 5, C_CLEANUP = 6 };
enum ax_status {
  S_ACQUIRE = 1, S_CREATE_ENTRY = 2, S_SET_TAG = 3, S_SET_QUALIFIER = 4,
  S_GET_PERMSET = 5, S_CLEAR_PERMS = 6, S_ADD_PERM = 7, S_SET_PERMSET = 8,
  S_PERM_READBACK = 9, S_GET_FLAGSET = 10, S_CLEAR_FLAGS = 11, S_SET_FLAGSET = 12,
  S_TAG_READBACK = 13, S_HELPER_FIRST = 14, S_HELPER_REPEAT = 15, S_FREE = 16
};

static const guid_t ax_literal_guid = { .g_guid = {
  0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
  0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff } };

/* Builds one explicit entry in a fresh acl_init(1) ACL. *out always receives the
 * latest (possibly updated) top-level handle, so cleanup frees the right one. */
static int ax_build_explicit(acl_tag_t tag, acl_t *out) {
  acl_t acl = acl_init(1);
  *out = acl;
  if (!acl) return S_ACQUIRE;
  acl_entry_t entry = NULL;
  if (acl_create_entry(&acl, &entry) != 0 || !entry) { *out = acl; return S_CREATE_ENTRY; }
  *out = acl;
  if (acl_set_tag_type(entry, tag) != 0) return S_SET_TAG;
  if (acl_set_qualifier(entry, &ax_literal_guid) != 0) return S_SET_QUALIFIER;
  acl_permset_t perms = NULL;
  if (acl_get_permset(entry, &perms) != 0 || !perms) return S_GET_PERMSET;
  if (acl_clear_perms(perms) != 0) return S_CLEAR_PERMS;
  if (acl_add_perm(perms, ACL_READ_DATA) != 0) return S_ADD_PERM;
  if (acl_set_permset(entry, perms) != 0) return S_SET_PERMSET;
  if (acl_get_perm_np(perms, ACL_READ_DATA) != 1) return S_PERM_READBACK;
  acl_flagset_t flags = NULL;
  if (acl_get_flagset_np(entry, &flags) != 0 || !flags) return S_GET_FLAGSET;
  if (acl_clear_flags_np(flags) != 0) return S_CLEAR_FLAGS;
  if (acl_set_flagset_np(entry, flags) != 0) return S_SET_FLAGSET;
  acl_tag_t observed = (acl_tag_t)0;
  if (acl_get_tag_type(entry, &observed) != 0 || observed != tag) return S_TAG_READBACK;
  return 0;
}

int main(void) {
  acl_t handles[5] = { NULL, NULL, NULL, NULL, NULL }; /* E0, E1, ED, A, D */
  int fail_case = 0, fail_status = 0;

  /* E0: acl_init(0), helper must return 1, repeated once on the same handle. */
  handles[0] = acl_init(0);
  if (!handles[0]) { fail_case = C_E0; fail_status = S_ACQUIRE; goto cleanup; }
  if (ax_acl_is_empty(handles[0]) != 1) { fail_case = C_E0; fail_status = S_HELPER_FIRST; goto cleanup; }
  if (ax_acl_is_empty(handles[0]) != 1) { fail_case = C_E0; fail_status = S_HELPER_REPEAT; goto cleanup; }

  /* E1: acl_init(1) with no entry created: empty-capacity control, must be 1. */
  handles[1] = acl_init(1);
  if (!handles[1]) { fail_case = C_E1; fail_status = S_ACQUIRE; goto cleanup; }
  if (ax_acl_is_empty(handles[1]) != 1) { fail_case = C_E1; fail_status = S_HELPER_FIRST; goto cleanup; }

  /* ED: acl_dup(E0): duplicate-empty serialization, must be 1. */
  handles[2] = acl_dup(handles[0]);
  if (!handles[2]) { fail_case = C_ED; fail_status = S_ACQUIRE; goto cleanup; }
  if (ax_acl_is_empty(handles[2]) != 1) { fail_case = C_ED; fail_status = S_HELPER_FIRST; goto cleanup; }

  /* A: one explicit allow entry, helper must return 0, repeated once. */
  { int s = ax_build_explicit(ACL_EXTENDED_ALLOW, &handles[3]);
    if (s) { fail_case = C_A; fail_status = s; goto cleanup; } }
  if (ax_acl_is_empty(handles[3]) != 0) { fail_case = C_A; fail_status = S_HELPER_FIRST; goto cleanup; }
  if (ax_acl_is_empty(handles[3]) != 0) { fail_case = C_A; fail_status = S_HELPER_REPEAT; goto cleanup; }

  /* D: one explicit deny entry, helper must return 0, repeated once. */
  { int s = ax_build_explicit(ACL_EXTENDED_DENY, &handles[4]);
    if (s) { fail_case = C_D; fail_status = s; goto cleanup; } }
  if (ax_acl_is_empty(handles[4]) != 0) { fail_case = C_D; fail_status = S_HELPER_FIRST; goto cleanup; }
  if (ax_acl_is_empty(handles[4]) != 0) { fail_case = C_D; fail_status = S_HELPER_REPEAT; goto cleanup; }

cleanup:
  /* Exactly one acl_free per successfully acquired top-level handle. */
  for (int i = 0; i < 5; i++) {
    if (handles[i] && acl_free(handles[i]) != 0 && !fail_case) {
      fail_case = C_CLEANUP; fail_status = S_FREE;
    }
    handles[i] = NULL;
  }
  if (fail_case) {
    printf("FAIL case=%d status=%d\n", fail_case, fail_status);
    return 1;
  }
  puts("PASS real in-memory ACL E0/E1/ED empty=1, explicit allow/deny=0, repeats and cleanup");
  return 0;
}
