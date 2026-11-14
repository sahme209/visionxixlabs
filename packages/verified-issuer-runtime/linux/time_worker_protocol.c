#include "time_worker_protocol.h"
#include <inttypes.h>
#include <stdio.h>
#include <string.h>

struct span { const unsigned char *data; size_t length; };
static int span_equal(struct span s,const char *literal) {
 size_t n=strlen(literal);return s.length==n && memcmp(s.data,literal,n)==0;
}
static int generation_length(const char *s,size_t *length) {
 if(!s||!length)return -1;
 size_t n=0;
 while(n<=AXIOM_WORKER_GENERATION_MAX && s[n]) {
  unsigned char c=(unsigned char)s[n];
  if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='_'||c=='-'))return -1;
  ++n;
 }
 if(n==0||n>AXIOM_WORKER_GENERATION_MAX)return -1;
 *length=n;return 0;
}
static int context_valid(const struct axiom_worker_context *context) {
 size_t length;return context?generation_length(context->generation,&length):-1;
}
/* Takes exactly count LF lines; callers decide whether remaining bytes are a
 * body. Bounded spans never borrow native ABI strings or modify input bytes. */
static int take_lines(const unsigned char *bytes,size_t length,size_t count,struct span *lines,size_t *used) {
 if(!bytes||!lines||!used)return -1;
 for(size_t i=0;i<length;++i)if(bytes[i]!='\n' && (bytes[i]<32||bytes[i]>126))return -1;
 size_t offset=0;
 for(size_t i=0;i<count;++i) {
  if(offset>=length)return -1;
  const unsigned char *end=memchr(bytes+offset,'\n',length-offset);
  if(!end)return -1;
  lines[i].data=bytes+offset;lines[i].length=(size_t)(end-(bytes+offset));
  offset+=lines[i].length+1;
 }
 *used=offset;return 0;
}
static int parse_uint(struct span s,uint64_t maximum,uint64_t *out) {
 if(!out||s.length==0||s.length>20||(s.length>1 && s.data[0]=='0'))return -1;
 uint64_t value=0;
 for(size_t i=0;i<s.length;++i) {
  if(s.data[i]<'0'||s.data[i]>'9')return -1;
  uint64_t digit=(uint64_t)(s.data[i]-'0');
  if(digit>maximum || value>(maximum-digit)/10)return -1;
  value=value*10+digit;
 }
 *out=value;return 0;
}
static int validate_record(const unsigned char *record,size_t length,const struct axiom_worker_context *context,uint64_t *publication,uint64_t *marker) {
 struct span lines[12];size_t used=0;uint64_t a,v,b,d;
 if(context_valid(context)||length==0||length>AXIOM_TIME_RECORD_MAX||take_lines(record,length,12,lines,&used)||used!=length)return -1;
 if(!span_equal(lines[0],AXIOM_TIME_MAGIC)||!span_equal(lines[1],AXIOM_TIME_LAYOUT)||!span_equal(lines[2],context->generation)||!span_equal(lines[11],"END"))return -1;
 if(parse_uint(lines[3],UINT64_MAX,publication)||*publication==0||parse_uint(lines[4],INT64_MAX,&a)||parse_uint(lines[5],INT64_MAX,&v)||v<=a||parse_uint(lines[6],INT64_MAX,&b)||parse_uint(lines[7],999999999,&d)||parse_uint(lines[9],UINT64_MAX,marker))return -1;
 if(!span_equal(lines[8],"unknown")&&!span_equal(lines[8],"synchronized")&&!span_equal(lines[8],"free-running")&&!span_equal(lines[8],"disrupted"))return -1;
 if(!span_equal(lines[10],"0")&&!span_equal(lines[10],"1"))return -1;
 return 0;
}
int axiom_worker_record_identity(const unsigned char *record,size_t length,const char *generation,uint64_t *publication,uint64_t *marker) {
 if(publication)*publication=0;
 if(marker)*marker=0;
 if(!publication||!marker)return -1;
 struct axiom_worker_context context;memset(&context,0,sizeof(context));size_t n=0;
 if(generation_length(generation,&n))return -1;
 memcpy(context.generation,generation,n);
 uint64_t p=0,m=0;
 if(validate_record(record,length,&context,&p,&m))return -1;
 *publication=p;*marker=m;return 0;
}
int axiom_worker_context_encode(const struct axiom_worker_context *context,unsigned char *out,size_t capacity,size_t *length) {
 if(length)*length=0;
 if(!out||!length||context_valid(context))return -1;
 unsigned char buffer[AXIOM_WORKER_CONTEXT_MAX+1];
 int n=snprintf((char *)buffer,sizeof(buffer),AXIOM_WORKER_CONTEXT_MAGIC "\n%s\n%" PRIu32 "\n%" PRIu32 "\n%" PRIu64 "\n%" PRIu64 "\nEND\n",context->generation,context->publisher_uid,context->reader_gid,context->directory_device,context->directory_inode);
 if(n<1||(size_t)n>AXIOM_WORKER_CONTEXT_MAX||(size_t)n>capacity)return -1;
 memcpy(out,buffer,(size_t)n);*length=(size_t)n;return 0;
}
int axiom_worker_context_decode(const unsigned char *bytes,size_t length,int end_of_input,struct axiom_worker_context *out) {
 if(!out)return -1;
 memset(out,0,sizeof(*out));
 struct axiom_worker_context value;memset(&value,0,sizeof(value));
 struct span lines[7];size_t used=0;uint64_t uid,gid;
 if(end_of_input!=1||length==0||length>AXIOM_WORKER_CONTEXT_MAX||take_lines(bytes,length,7,lines,&used)||used!=length)return -1;
 if(!span_equal(lines[0],AXIOM_WORKER_CONTEXT_MAGIC)||!span_equal(lines[6],"END")||lines[1].length==0||lines[1].length>AXIOM_WORKER_GENERATION_MAX)return -1;
 memcpy(value.generation,lines[1].data,lines[1].length);
 if(context_valid(&value)||parse_uint(lines[2],UINT32_MAX,&uid)||parse_uint(lines[3],UINT32_MAX,&gid)||parse_uint(lines[4],UINT64_MAX,&value.directory_device)||parse_uint(lines[5],UINT64_MAX,&value.directory_inode))return -1;
 value.publisher_uid=(uint32_t)uid;value.reader_gid=(uint32_t)gid;*out=value;return 0;
}
int axiom_worker_capture_encode(const struct axiom_worker_context *context,const struct axiom_time_capture *capture,unsigned char *out,size_t capacity,size_t *length) {
 if(length)*length=0;
 if(!capture||!out||!length||context_valid(context)||capture->time_authority!=0||capture->bytes==0||capture->bytes>AXIOM_TIME_RECORD_MAX)return -1;
 uint64_t publication=0,marker=0;
 if(validate_record(capture->record,capture->bytes,context,&publication,&marker)||publication!=capture->publication||marker!=capture->disruption_marker||capture->realtime_ns>INT64_MAX||capture->p0_ns>capture->p1_ns||capture->p1_ns>capture->p2_ns||capture->p2_ns>INT64_MAX)return -1;
 unsigned char buffer[AXIOM_WORKER_FRAME_MAX];
 int n=snprintf((char *)buffer,AXIOM_WORKER_HEADER_MAX+1,AXIOM_WORKER_CAPTURE_MAGIC "\n%zu\n%" PRIu64 "\n%" PRIu64 "\n%" PRIu64 "\n%" PRIu64 "\n%" PRIu64 "\n%" PRIu64 "\n%" PRIu64 "\n%" PRIu64 "\nEND_HEADER\n",capture->bytes,capture->device,capture->inode,capture->publication,capture->disruption_marker,capture->realtime_ns,capture->p0_ns,capture->p1_ns,capture->p2_ns);
 if(n<1||(size_t)n>AXIOM_WORKER_HEADER_MAX)return -1;
 size_t header=(size_t)n;
 if(capture->bytes>AXIOM_WORKER_FRAME_MAX-header||header+capture->bytes>capacity)return -1;
 memcpy(buffer+header,capture->record,capture->bytes);
 memcpy(out,buffer,header+capture->bytes);*length=header+capture->bytes;return 0;
}
int axiom_worker_capture_decode(const unsigned char *bytes,size_t length,int end_of_input,const struct axiom_worker_context *context,struct axiom_time_capture *out) {
 if(!out)return -1;
 memset(out,0,sizeof(*out));out->held_fd=-1;out->time_authority=0;
 struct axiom_time_capture value;memset(&value,0,sizeof(value));value.held_fd=-1;
 struct span lines[11];size_t used=0;uint64_t record_length,record_publication=0,record_marker=0;
 if(end_of_input!=1||length==0||length>AXIOM_WORKER_FRAME_MAX||context_valid(context)||take_lines(bytes,length,11,lines,&used)||used>AXIOM_WORKER_HEADER_MAX)return -1;
 if(!span_equal(lines[0],AXIOM_WORKER_CAPTURE_MAGIC)||!span_equal(lines[10],"END_HEADER")||parse_uint(lines[1],AXIOM_TIME_RECORD_MAX,&record_length)||record_length==0||length-used!=record_length)return -1;
 if(parse_uint(lines[2],UINT64_MAX,&value.device)||parse_uint(lines[3],UINT64_MAX,&value.inode)||parse_uint(lines[4],UINT64_MAX,&value.publication)||value.publication==0||parse_uint(lines[5],UINT64_MAX,&value.disruption_marker)||parse_uint(lines[6],INT64_MAX,&value.realtime_ns)||parse_uint(lines[7],INT64_MAX,&value.p0_ns)||parse_uint(lines[8],INT64_MAX,&value.p1_ns)||parse_uint(lines[9],INT64_MAX,&value.p2_ns)||value.p0_ns>value.p1_ns||value.p1_ns>value.p2_ns)return -1;
 if(validate_record(bytes+used,(size_t)record_length,context,&record_publication,&record_marker)||record_publication!=value.publication||record_marker!=value.disruption_marker)return -1;
 value.bytes=(size_t)record_length;memcpy(value.record,bytes+used,value.bytes);*out=value;return 0;
}
