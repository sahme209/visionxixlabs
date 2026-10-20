import AuthFormClient from "./AuthFormClient";
import { ensureCanonicalAuthPage } from "@/lib/auth/canonicalAuthPage";

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await ensureCanonicalAuthPage("signin", await searchParams);
  return <AuthFormClient />;
}
