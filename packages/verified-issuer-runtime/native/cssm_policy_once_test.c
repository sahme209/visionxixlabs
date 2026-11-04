#include "cssm_policy_once.h"
#include <assert.h>
#include <pthread.h>
#include <stdio.h>
static atomic_flag attempted=ATOMIC_FLAG_INIT;
static atomic_uint winners=0;
static atomic_uint ready=0;
static atomic_bool start=0;
static void *claim(void *unused) {
 (void)unused;
 atomic_fetch_add_explicit(&ready,1,memory_order_relaxed);
 while(!atomic_load_explicit(&start,memory_order_acquire)) {}
 if(ax_cssm_claim_once(&attempted)) atomic_fetch_add_explicit(&winners,1,memory_order_relaxed);
 return NULL;
}
int main(void) {
 pthread_t threads[32];
 for(unsigned i=0;i<32;i++) assert(!pthread_create(&threads[i],NULL,claim,NULL));
 while(atomic_load_explicit(&ready,memory_order_relaxed)!=32) {}
 atomic_store_explicit(&start,1,memory_order_release);
 for(unsigned i=0;i<32;i++) assert(!pthread_join(threads[i],NULL));
 assert(atomic_load_explicit(&winners,memory_order_relaxed)==1);
 /* No successful result/reset follows the winning claim: failure is consumed. */
 assert(!ax_cssm_claim_once(&attempted));
 puts("PASS: exactly one of 32 concurrent claims; subsequent attempt refused after consumed failure");
 return 0;
}
