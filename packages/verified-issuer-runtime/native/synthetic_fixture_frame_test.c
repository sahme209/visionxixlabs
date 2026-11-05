#include "synthetic_fixture_frame.h"
#include <assert.h>
#include <string.h>
int main(void){AxSyntheticFixtureFrame in={0},out={0};unsigned char bytes[AX_FIXTURE_FRAME_SIZE];for(unsigned i=0;i<32;i++){in.password[i]=(unsigned char)i;in.vault[i]=(unsigned char)(i+1);in.session[i]=(unsigned char)(i+2);}assert(ax_fixture_frame_encode(&in,bytes,sizeof bytes));assert(ax_fixture_frame_decode(bytes,sizeof bytes,&out));assert(!memcmp(&in,&out,sizeof in));assert(!ax_fixture_frame_decode(bytes,sizeof bytes-1,&out));bytes[0]^=1;assert(!ax_fixture_frame_decode(bytes,sizeof bytes,&out));ax_fixture_frame_wipe(&in);for(unsigned i=0;i<sizeof in;i++)assert(!((unsigned char*)&in)[i]);return 0;}
