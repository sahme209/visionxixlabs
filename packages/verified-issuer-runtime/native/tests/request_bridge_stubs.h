#ifndef AX_REQUEST_BRIDGE_STUBS
#define AX_REQUEST_BRIDGE_STUBS
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdatomic.h>
#include <assert.h>
#include "../request_protocol.h"
typedef struct Obj Obj;typedef Obj*xpc_object_t;typedef Obj*xpc_connection_t;struct Obj{int type;const char*key[10];Obj*value[10];size_t count,length;const char*text;unsigned char data[AX_REQUEST_FRAME_CAP];uint64_t number;};
#define XPC_TYPE_DICTIONARY 1
#define XPC_TYPE_UINT64 2
#define XPC_TYPE_CONNECTION 3
static xpc_object_t sent;static unsigned send_count;
static Obj*obj(int type){Obj*v=calloc(1,sizeof(*v));assert(v);v->type=type;return v;}
static int xpc_get_type(Obj*v){return v?v->type:0;}
static Obj*xpc_dictionary_create(void*a,void*b,size_t c){(void)a;(void)b;(void)c;return obj(1);}
static void put(Obj*m,const char*k,Obj*v){assert(m->count<10);m->key[m->count]=k;m->value[m->count++]=v;}
static Obj*xpc_dictionary_get_value(Obj*m,const char*k){if(!m)return NULL;for(size_t n=0;n<m->count;n++)if(!strcmp(k,m->key[n]))return m->value[n];return NULL;}
static size_t xpc_dictionary_get_count(Obj*m){return m?m->count:0;}
static const char*xpc_dictionary_get_string(Obj*m,const char*k){Obj*v=xpc_dictionary_get_value(m,k);return v?v->text:NULL;}
static void xpc_dictionary_set_string(Obj*m,const char*k,const char*s){Obj*v=obj(4);v->text=s;put(m,k,v);}
static void xpc_dictionary_set_uint64(Obj*m,const char*k,uint64_t n){Obj*v=obj(2);v->number=n;put(m,k,v);}
static uint64_t xpc_uint64_get_value(Obj*v){return v->number;}
static void xpc_dictionary_set_data(Obj*m,const char*k,const void*b,size_t n){Obj*v=obj(5);assert(n<=sizeof(v->data));memcpy(v->data,b,n);v->length=n;put(m,k,v);}
static const void*xpc_dictionary_get_data(Obj*m,const char*k,size_t*n){Obj*v=xpc_dictionary_get_value(m,k);*n=v?v->length:0;return v?v->data:NULL;}
static Obj*xpc_dictionary_create_reply(Obj*m){(void)m;return obj(1);}
static Obj*xpc_retain(Obj*m){return m;}static void xpc_release(Obj*m){(void)m;}
static void xpc_connection_send_message(Obj*c,Obj*m){(void)c;sent=m;send_count++;}
typedef int dispatch_queue_t;typedef int dispatch_semaphore_t;
static void dispatch_async(dispatch_queue_t q,void(^block)(void)){(void)q;block();}
static void dispatch_semaphore_signal(int sem){(void)sem;}
static uint64_t fake_now=10;static uint64_t now_ns(void){return fake_now;}static uint64_t clock_ns(void){return fake_now;}
#endif
