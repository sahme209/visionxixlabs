#include "origin_private_bootstrap.h"
#include <string.h>
/* Strict UTF-8: reject overlong, surrogate, out-of-range and NUL scalars. */
static int valid_utf8(const unsigned char*p,size_t n){
 for(size_t i=0;i<n;){unsigned char c=p[i++];if(!c)return 0;if(c<0x80)continue;unsigned need;uint32_t value,minimum;
  if(c>=0xc2&&c<=0xdf){need=1;value=c&31;minimum=0x80;}else if(c>=0xe0&&c<=0xef){need=2;value=c&15;minimum=0x800;}else if(c>=0xf0&&c<=0xf4){need=3;value=c&7;minimum=0x10000;}else return 0;
  if(n-i<need)return 0;while(need--){unsigned char next=p[i++];if((next&0xc0)!=0x80)return 0;value=(value<<6)|(next&63);}if(value<minimum||value>0x10ffff||(value>=0xd800&&value<=0xdfff))return 0;
 }return 1;
}
static void put32(unsigned char*p,uint32_t n){for(int i=3;i>=0;i--){p[i]=(unsigned char)n;n>>=8;}}
static void put64(unsigned char*p,uint64_t n){for(int i=7;i>=0;i--){p[i]=(unsigned char)n;n>>=8;}}
int axiom_private_frame_encode(unsigned char out[AXIOM_PRIVATE_FRAME_CAP],size_t*length,const AxiomPrivateBinding*b,const AxiomPrivateMaterial*m){
 if(length)*length=0;if(!out||!length||!b||!m||!b->epoch||!b->deadline||!m->datasource_length||m->datasource_length>8192||m->session_length<32||m->session_length>4096||!valid_utf8(m->datasource,m->datasource_length))return 0;
 size_t n=AXIOM_PRIVATE_FRAME_HEADER+m->datasource_length+32+m->session_length;if(n>=AXIOM_PRIVATE_FRAME_CAP)return 0;
 memset(out,0,AXIOM_PRIVATE_FRAME_HEADER);memcpy(out,"axiom.private/1",16);put32(out+16,(uint32_t)n);put32(out+20,(uint32_t)m->datasource_length);put32(out+24,(uint32_t)m->session_length);put64(out+32,b->epoch);put64(out+40,b->deadline);memcpy(out+48,b->client,32);memcpy(out+80,b->broker,32);
 size_t offset=AXIOM_PRIVATE_FRAME_HEADER;memcpy(out+offset,m->datasource,m->datasource_length);offset+=m->datasource_length;memcpy(out+offset,m->vault,32);offset+=32;memcpy(out+offset,m->session,m->session_length);*length=n;return 1;
}
