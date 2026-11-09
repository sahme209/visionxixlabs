import { redirect } from "next/navigation";

/** No mobile apps are offered; the desktop download is the authority on platforms. Logic audit 2026-11-09. */
export default function PlatformsPage() {
  redirect("/download");
}
