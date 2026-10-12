import { redirect } from "next/navigation";

export default function ServicesRedirect(): never {
  redirect("/product");
}
