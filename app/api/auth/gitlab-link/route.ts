import { enabledOAuthProviders } from "@/lib/auth";
import { createIdentityLinkHandlers } from "@/lib/auth/identityLinkHttp";

export const dynamic = "force-dynamic";
export const { GET, POST } = createIdentityLinkHandlers("gitlab", () => enabledOAuthProviders.gitlab);
