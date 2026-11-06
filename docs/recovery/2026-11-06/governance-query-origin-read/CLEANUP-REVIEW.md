# Collector cleanup correction — local only

Independent source review identified unbounded process.wait() after timeout and missing interruption cleanup; the draft22+5bound was not true of that earlier source. New4mocked cases RED3fail+1error reproduced timeout wait, unknowncleanup, interruption and process-lookup race. Fixed one owned-group signal only while originalchild unreaped, bounded wait5seconds, unknown preservation, and exception-safe cleanup.4GREEN plus2selected existing mocked worker-receipt/positive-proof validation cases PASS. No actual processes/network were executed by these tests; earlier actual-child tests not repeated.

Independent followup review PASS/no remaining important findings. URL/selection/body/proxy/redirect/auth/cookie/no-retry request behavior unchanged. REVIEW and source SHA updated before the fresh read question. No HTTP authority or request from local cleanup work.
