/* Pure buffer validation only: never calls reader/OS supplier/addon/bootstrap. */
#include "origin_private_bootstrap.c"
#include <assert.h>
int main(void){
 AxiomPrivateBinding binding={.epoch=42,.deadline=1234};binding.client[0]=1;binding.broker[0]=2;
 AxiomPrivateMaterial material={.datasource_length=12,.session_length=32};memcpy(material.datasource,"postgres://x",12);
 unsigned char frame[AXIOM_PRIVATE_FRAME_CAP];size_t length=0;
 assert(axiom_private_frame_encode(frame,&length,&binding,&material));assert(valid_header(frame,&binding));
 const size_t offsets[]={0,15,16,20,24,28,32,40,48,80};
 for(size_t i=0;i<sizeof(offsets)/sizeof(offsets[0]);i++){frame[offsets[i]]^=128;assert(!valid_header(frame,&binding));frame[offsets[i]]^=128;}
 AxiomPrivateBinding other=binding;other.epoch++;assert(!valid_header(frame,&other));other=binding;other.deadline++;assert(!valid_header(frame,&other));
 assert(utf8((const unsigned char*)"postgres://x",12));
 const unsigned char invalid[][4]={{0},{0xc0,0x80},{0xed,0xa0,0x80},{0xf4,0x90,0x80,0x80},{0xe2,0x82,0,0}};
 for(size_t i=0;i<sizeof(invalid)/sizeof(invalid[0]);i++)assert(!utf8(invalid[i],4));
 const unsigned char valid[]={0xf0,0x90,0x80,0x80};assert(utf8(valid,4));assert(!utf8(valid,3));
 memset(&material,127,sizeof(material));axiom_private_material_wipe(&material);const unsigned char*p=(const unsigned char*)&material;for(size_t i=0;i<sizeof(material);i++)assert(p[i]==0);
 return 0;
}
