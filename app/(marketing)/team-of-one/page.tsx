/** Legacy campaign URL retained for existing links. */

import { redirect } from "next/navigation";

export default function TeamOfOneRedirect(): never {
  redirect("/product");
}
