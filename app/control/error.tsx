"use client";
export default function ControlError({reset}: {reset:()=>void}) {
 return <div role="alert" className="max-w-xl rounded-xl border border-white/10 bg-[#171717] p-6"><h1 className="text-xl font-medium">This page couldn’t load</h1><p className="mt-3 text-sm leading-6 text-zinc-400">Workspace records are temporarily unavailable. You can try again or use another cockpit section. No account changes are confirmed by this message.</p><button type="button" onClick={reset} className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5">Try again</button></div>;
}
