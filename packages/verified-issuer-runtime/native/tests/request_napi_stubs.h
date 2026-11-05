#ifndef AX_REQUEST_NAPI_STUBS
#define AX_REQUEST_NAPI_STUBS
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <stdatomic.h>
#include <assert.h>
#include "../request_protocol.h"
typedef struct V{int type;char text[130];unsigned char bytes[16];size_t length;}V;
typedef void*napi_env;typedef V*napi_value;typedef void*napi_callback_info;typedef int napi_status;typedef int napi_valuetype;typedef int napi_typedarray_type;typedef void*napi_deferred;
#define napi_ok 0
#define napi_string 1
#define napi_uint8_array 2
#define NAPI_AUTO_LENGTH SIZE_MAX
#define AXIOM_ORIGIN_EXCHANGE_NS 250000000ULL
typedef struct W{void(*execute)(napi_env,void*);void(*complete)(napi_env,napi_status,void*);void*data;}*napi_async_work;
typedef struct{int unused;}AxiomOriginSession;
typedef struct{atomic_uint refs;atomic_int invalid;int request_waiting,bootstrap_consumed;AxiomOriginSession*session;int startup;}NativeOrigin;
typedef struct {int cancelled;char id[65];size_t length;unsigned char bytes[AX_REQUEST_INPUT_CAP];}AxiomRequestEvent;
static NativeOrigin*owned;static unsigned argument_count;static napi_value arguments[3];static napi_async_work queued;static unsigned refused,rejected,resolved,current_calls,complete_calls,closed;
static int current_ok=1;static uint64_t now=1;
static uint64_t monotonic_ns(void){return now;}
static int pthread_main_np(void){return 1;}static const char*fixed_process_failure(int x){(void)x;return NULL;}static int axiom_origin_identity_current(int*x){(void)x;return 1;}
static int axiom_origin_session_locally_valid(AxiomOriginSession*s){(void)s;return !atomic_load(&owned->invalid);}
static int axiom_origin_session_next_request(AxiomOriginSession*s,AxiomRequestEvent*out){(void)s;if(atomic_load(&owned->invalid))return 0;memset(out,0,sizeof(*out));memset(out->id,'a',64);out->length=1;out->bytes[0]=9;return 1;}
static int axiom_origin_session_request_current(AxiomOriginSession*s,const unsigned char*i){(void)s;(void)i;current_calls++;return current_ok;}
static int axiom_origin_session_complete_request(AxiomOriginSession*s,const unsigned char*i,const void*b,size_t n){(void)s;(void)i;uint32_t status;size_t length;if(!ax_request_response(b,n,&status,&length))return 0;complete_calls++;return 1;}
static void axiom_origin_session_revoke(AxiomOriginSession*s){(void)s;closed++;}static void release_origin(NativeOrigin*o){atomic_fetch_sub(&o->refs,1);}
static napi_value refuse(napi_env e,const char*r){(void)e;(void)r;refused++;return NULL;}
static V*val(void){V*v=calloc(1,sizeof(*v));assert(v);return v;}
static napi_status napi_get_cb_info(napi_env e,napi_callback_info i,size_t*n,napi_value*a,void*t,void**data){(void)e;(void)i;(void)t;size_t count=*n<argument_count?*n:argument_count;for(size_t k=0;k<count;k++)a[k]=arguments[k];*n=argument_count;*data=owned;return 0;}
static napi_status napi_get_undefined(napi_env e,napi_value*out){(void)e;*out=val();return 0;}
static napi_status napi_typeof(napi_env e,napi_value v,napi_valuetype*out){(void)e;*out=v->type;return 0;}
static napi_status napi_get_value_string_utf8(napi_env e,napi_value v,char*b,size_t cap,size_t*n){(void)e;size_t z=strlen(v->text);if(!b){*n=z;return 0;}*n=z<cap-1?z:cap-1;memcpy(b,v->text,*n);b[*n]=0;return 0;}
static napi_status napi_create_object(napi_env e,napi_value*out){(void)e;*out=val();return 0;}
static napi_status napi_create_string_utf8(napi_env e,const char*s,size_t n,napi_value*out){(void)e;*out=val();(*out)->type=1;if(n==SIZE_MAX)n=strlen(s);assert(n<130);memcpy((*out)->text,s,n);return 0;}
static napi_status napi_set_named_property(napi_env e,napi_value o,const char*k,napi_value v){(void)e;(void)o;(void)k;(void)v;return 0;}
static napi_status napi_create_arraybuffer(napi_env e,size_t n,void**data,napi_value*out){(void)e;*out=val();assert(n<=16);*data=(*out)->bytes;return 0;}
static napi_status napi_create_typedarray(napi_env e,int t,size_t n,napi_value b,size_t off,napi_value*out){(void)e;(void)t;(void)n;(void)off;*out=b;return 0;}
static napi_status napi_get_typedarray_info(napi_env e,napi_value v,napi_typedarray_type*t,size_t*n,void**data,napi_value*b,size_t*off){(void)e;*t=v->type;*n=v->length;*data=v->bytes;*b=v;*off=0;return 0;}
static napi_status napi_object_freeze(napi_env e,napi_value v){(void)e;(void)v;return 0;}
static napi_status napi_resolve_deferred(napi_env e,napi_deferred d,napi_value v){(void)e;(void)d;(void)v;resolved++;return 0;}
static napi_status napi_reject_deferred(napi_env e,napi_deferred d,napi_value v){(void)e;(void)d;(void)v;rejected++;return 0;}
static napi_status napi_create_error(napi_env e,napi_value code,napi_value msg,napi_value*out){(void)e;(void)code;(void)msg;*out=val();return 0;}
static napi_status napi_delete_async_work(napi_env e,napi_async_work w){(void)e;free(w);return 0;}
static napi_status napi_create_promise(napi_env e,napi_deferred*d,napi_value*out){(void)e;*d=(void*)1;*out=val();return 0;}
static napi_status napi_create_async_work(napi_env e,void*r,napi_value name,void(*exec)(napi_env,void*),void(*complete)(napi_env,napi_status,void*),void*data,napi_async_work*out){(void)e;(void)r;(void)name;*out=calloc(1,sizeof(**out));(*out)->execute=exec;(*out)->complete=complete;(*out)->data=data;return 0;}
static napi_status napi_queue_async_work(napi_env e,napi_async_work w){(void)e;queued=w;return 0;}
#endif
