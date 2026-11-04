/* Pure synthetic buffers only: no broker, native helper, Keychain or identity. */
#include "../origin_private_bootstrap.h"
#include <assert.h>
#include <string.h>
int main(void){
 AxiomPrivateMaterial material={0};AxiomPrivateBinding binding={.epoch=7,.deadline=180};unsigned char frame[AXIOM_PRIVATE_FRAME_CAP];size_t length=9;
 memset(material.datasource,'x',8192);material.datasource_length=8192;material.session_length=4096;memset(material.vault,0xa5,32);memset(material.session,0x5a,4096);memset(binding.client,1,32);memset(binding.broker,2,32);
 assert(axiom_private_frame_encode(frame,&length,&binding,&material));assert(length==112+8192+32+4096);assert(!memcmp(frame,"axiom.private/1",16));assert(frame[39]==7&&frame[47]==180);assert(!memcmp(frame+48,binding.client,32));assert(!memcmp(frame+80,binding.broker,32));assert(!memcmp(frame+112+8192,material.vault,32));
 material.datasource_length=8193;assert(!axiom_private_frame_encode(frame,&length,&binding,&material)&&length==0);material.datasource_length=1;material.datasource[0]=0;assert(!axiom_private_frame_encode(frame,&length,&binding,&material));material.datasource[0]=0xff;assert(!axiom_private_frame_encode(frame,&length,&binding,&material));
 material.datasource[0]='x';material.session_length=31;assert(!axiom_private_frame_encode(frame,&length,&binding,&material));material.session_length=4097;assert(!axiom_private_frame_encode(frame,&length,&binding,&material));material.session_length=32;binding.epoch=0;assert(!axiom_private_frame_encode(frame,&length,&binding,&material));binding.epoch=7;
 material.datasource_length=3;material.datasource[0]=0xed;material.datasource[1]=0xa0;material.datasource[2]=0x80;assert(!axiom_private_frame_encode(frame,&length,&binding,&material));material.datasource[0]=0xe2;material.datasource[1]=0x82;material.datasource[2]=0xac;assert(axiom_private_frame_encode(frame,&length,&binding,&material));
 return 0;
}
