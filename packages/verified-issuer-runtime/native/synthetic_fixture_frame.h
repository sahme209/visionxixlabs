#ifndef AX_SYNTHETIC_FIXTURE_FRAME_H
#define AX_SYNTHETIC_FIXTURE_FRAME_H
#include <stddef.h>
#include "synthetic_resource_contract.h"
#define AX_FIXTURE_FRAME_SIZE 136U
/* magic/version8 + fixed generation32 + three independently random32-byte values */
typedef struct {unsigned char password[32],vault[32],session[32];} AxSyntheticFixtureFrame;
int ax_fixture_frame_encode(const AxSyntheticFixtureFrame*,unsigned char*,size_t);
int ax_fixture_frame_decode(const unsigned char*,size_t,AxSyntheticFixtureFrame*);
void ax_fixture_frame_wipe(AxSyntheticFixtureFrame*);
#endif
