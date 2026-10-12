import { redirect } from "next/navigation";

export default function CloudSecurityRedirect(): never {
  redirect("/security");
}
