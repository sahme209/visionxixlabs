import { redirect } from "next/navigation";
export default async function TeamRedirect({searchParams}: {searchParams?: Promise<Record<string,string|string[]|undefined>>}) {
 const params = await searchParams ?? {};
 const query = new URLSearchParams();
 for (const key of ["notice", "error", "inviteUrl"]) if (typeof params[key] === "string") query.set(key, params[key] as string);
 redirect(`/control/members${query.size ? `?${query}` : ""}`);
}
