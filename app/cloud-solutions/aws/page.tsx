import { redirect } from "next/navigation";

export default function AwsSolutionsRedirect(): never {
  redirect("/integrations");
}
