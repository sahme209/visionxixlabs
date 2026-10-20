import AuthFormClient from "./AuthFormClient";
import { ensureCanonicalAuthPage } from "@/lib/auth/canonicalAuthPage";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await ensureCanonicalAuthPage("signup", await searchParams);
  return <AuthFormClient />;
}
