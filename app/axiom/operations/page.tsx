/**
 * Legacy browser-operations URL.
 *
 * Operational product work is desktop-only. Keeping this redirect prevents
 * old links from presenting the retired web dashboard as a live surface.
 */

import { redirect } from "next/navigation";

export default function AxiomOperationsRedirect(): never {
  redirect("/product");
}
