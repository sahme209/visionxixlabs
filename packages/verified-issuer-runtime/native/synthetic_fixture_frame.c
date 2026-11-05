#include "synthetic_fixture_frame.h"
#include <string.h>
static const unsigned char magic[8]={'A','X','F','I','X',0,0,1};
void ax_fixture_frame_wipe(AxSyntheticFixtureFrame*f){if(f){volatile unsigned char*p=(volatile unsigned char*)f;for(size_t i=0;i<sizeof *f;i++)p[i]=0;}}
int ax_fixture_frame_encode(const AxSyntheticFixtureFrame*f,unsigned char*out,size_t n){if(!f||!out||n!=AX_FIXTURE_FRAME_SIZE||strlen(AX_SYNTH_GENERATION)!=32)return 0;memcpy(out,magic,8);memcpy(out+8,AX_SYNTH_GENERATION,32);memcpy(out+40,f->password,32);memcpy(out+72,f->vault,32);memcpy(out+104,f->session,32);return 1;}
int ax_fixture_frame_decode(const unsigned char*in,size_t n,AxSyntheticFixtureFrame*out){if(!out)return 0;ax_fixture_frame_wipe(out);if(!in||n!=AX_FIXTURE_FRAME_SIZE||memcmp(in,magic,8)||memcmp(in+8,AX_SYNTH_GENERATION,32))return 0;memcpy(out->password,in+40,32);memcpy(out->vault,in+72,32);memcpy(out->session,in+104,32);return 1;}
