import { redirect } from "next/navigation";

/** Legacy route: redirect to canonical /builder */
export default function WebsiteBuilderRedirect() {
  redirect("/builder");
}
