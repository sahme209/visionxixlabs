import { redirect } from "next/navigation";
export default async function AuthSuccessPage({searchParams}: {searchParams: Promise<{integration?: string; status?: string}>}) {
  const params = await searchParams;
  if (params.integration) {
    const query = new URLSearchParams();
    if (["github", "slack", "teams", "linear"].includes(params.integration)) query.set("integration", params.integration);
    if (typeof params.status === "string") query.set("status", params.status);
    redirect(`/control/connection-return?${query}`);
  }
  redirect("/control");
}
