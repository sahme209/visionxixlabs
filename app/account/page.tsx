import { redirect } from "next/navigation";
export default async function AccountPage({searchParams}: {searchParams?: Promise<{billing?:string|string[]}>}) {
 const params = await searchParams;
 redirect(params?.billing === "return" ? "/control/usage-billing" : "/control/settings");
}
