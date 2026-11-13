import React from 'react';
/** A missing platform decision is not evidence that IAM needs wider grants. */
export function isTemplateReviewBlocked(reason:unknown){return reason==='platform_review_required'||reason==='platform_template_unavailable'}
export function TemplateReviewNotice(){return <section role="status" className="rounded-[28px] border border-white/6 bg-[#0a0a0c]/70 px-8 sm:px-12 py-12">
 <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500">aws · operator review required</p>
 <h2 className="mt-3 text-[24px] sm:text-[28px] leading-[1.15] font-medium text-white tracking-[-0.02em]">Template access needs a reviewed action.</h2>
 <p className="mt-3 text-[14px] text-zinc-400 leading-relaxed max-w-xl">A platform operator must prepare the exact template action and obtain independent review. Managed access remains unavailable until its execution and access checks are enabled.</p>
 <p className="mt-3 text-[14px] text-zinc-400 leading-relaxed max-w-xl">Reloading this page or adding IAM permissions cannot approve this action. No automatic publication or new deployment was started.</p>
 <a href="/docs" className="mt-7 inline-flex text-[14px] text-white underline underline-offset-4">Read the setup documentation</a>
 </section>}
