import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { AuthForm } from "@/app/auth/form";

export const dynamic = "force-dynamic";

export default async function Signup({ searchParams }: PageProps<"/signup">) {
  if (await getIdentity()) redirect("/app");
  const params = await searchParams;
  return <AuthForm mode="signup" error={typeof params.error === "string" ? params.error : undefined} />;
}
