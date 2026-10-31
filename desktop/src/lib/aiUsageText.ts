/** Display provider evidence only. Missing/invalid counts are never estimated. */
export function aiUsageText(usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }): string {
 const count = (n: number | null) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 ? n.toLocaleString("en-US") : null;
 const input=count(usage.inputTokens), output=count(usage.outputTokens), total=count(usage.totalTokens);
 const parts:string[]=[];
 if(total!==null)parts.push(`${total} total tokens`);
 if(input!==null||output!==null)parts.push(`${input??"Not reported"} input · ${output??"Not reported"} output tokens`);
 return parts.length?parts.join(" · "):"Token counts were not reported by the provider.";
}
