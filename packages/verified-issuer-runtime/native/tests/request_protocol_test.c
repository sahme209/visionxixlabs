#include "../request_protocol.h"
#include <assert.h>
#include <string.h>
int main(void){AxRequestSlot s={0};unsigned char id[32]={1},other[32]={2},frame[9]={0,0,0,200,0,0,0,1,42};
 assert(ax_request_admit(&s,1,2,3,100,10,id,10));assert(!ax_request_admit(&s,1,2,3,100,10,id,10));
 assert(ax_request_dispatch(&s,11));assert(ax_request_current(&s,2,3,id,12));assert(!ax_request_current(&s,4,3,id,12));assert(!ax_request_cancel(&s,5,id));assert(ax_request_cancel(&s,1,id));assert(!ax_request_current(&s,2,3,id,13));assert(!ax_request_complete(&s,2,3,id,14,frame,9));
 memset(&s,0,sizeof(s));assert(ax_request_admit(&s,1,2,3,100,10,id,4096));assert(ax_request_dispatch(&s,11));assert(!ax_request_current(&s,2,3,other,12));assert(ax_request_complete(&s,2,3,id,14,frame,9));assert(!ax_request_complete(&s,2,3,id,14,frame,9));
 memset(&s,0,sizeof(s));assert(!ax_request_admit(&s,1,2,3,100,10,id,4097));assert(ax_request_admit(&s,1,2,3,100,10,id,1));assert(ax_request_dispatch(&s,11));assert(!ax_request_current(&s,2,3,id,100));assert(s.phase==AX_REQUEST_EXPIRED);
 char text[65];unsigned char parsed[32];ax_request_id_text(id,text);assert(ax_request_id_parse(text,parsed)&&!memcmp(id,parsed,32));text[4]='G';assert(!ax_request_id_parse(text,parsed));uint32_t status;size_t size;assert(ax_request_response(frame,9,&status,&size)&&status==200&&size==1);frame[7]=2;assert(!ax_request_response(frame,9,&status,&size));return 0;}
