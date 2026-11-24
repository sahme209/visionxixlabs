import { createIdentityLinkHandlers } from "@/lib/auth/identityLinkHttp";

export const dynamic = "force-dynamic";
export const { GET, POST } = createIdentityLinkHandlers("google");
