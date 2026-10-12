import { redirect } from "next/navigation";

export default function GcpSolutionsRedirect(): never {
  redirect("/integrations");
}
