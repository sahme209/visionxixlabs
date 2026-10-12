/**
 * Legacy ReleaseOps campaign URL.
 *
 * The canonical product page reflects the release-verified desktop workflow
 * and integration states. Preserve old links without retaining overclaims.
 */

import { redirect } from "next/navigation";

export default function AxiomReleaseOpsRedirect(): never {
  redirect("/product");
}
