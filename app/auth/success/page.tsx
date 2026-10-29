import { redirect } from "next/navigation";
import { connectionReturnQuery, type ConnectionReturnParams } from "@/lib/integrations/connectionReturnParams";
export default async function AuthSuccessPage({searchParams}: {searchParams: Promise<ConnectionReturnParams>}) {
  const query = connectionReturnQuery(await searchParams);
  if (query.has("integration")) redirect(`/control/connection-return?${query}`);
  redirect("/control");
}
