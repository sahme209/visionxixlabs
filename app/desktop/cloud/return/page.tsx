'use client';
import {useEffect} from 'react';
import {CLOUD_NATIVE_RETURN,scheduleCloudNativeReturn} from '@/lib/desktop/cloudNativeReturn';
/** Supporting native-app authorization handoff, not a cockpit redesign. */
export default function CloudConnectionReturn(){
 useEffect(()=>{const timer=scheduleCloudNativeReturn(url=>{try{window.location.assign(url)}catch{/* The fixed Open button remains available. */}},window.setTimeout);return()=>window.clearTimeout(timer as number)},[]);
 return <main className="flex min-h-screen items-center justify-center bg-[#09090b] p-6 text-zinc-100"><section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.025] p-8"><p className="text-xs text-zinc-500">Axiom cloud connection</p><h1 className="mt-3 text-2xl font-medium tracking-tight">Return to Axiom</h1><p className="mt-4 text-sm leading-6 text-zinc-400">Axiom will check the saved sign-in result and show any project selection or recovery action. This page does not establish cloud access.</p><a href={CLOUD_NATIVE_RETURN} className="mt-6 inline-flex rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950">Open Axiom</a></section></main>;
}
