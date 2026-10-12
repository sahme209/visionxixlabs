import { redirect } from "next/navigation";

export default function AzureSolutionsRedirect(): never {
  redirect("/integrations");
}
