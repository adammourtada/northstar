import { redirect } from "next/navigation";
import { getIdentity } from "@/lib/auth";
import { AuthForm } from "@/app/auth/form";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: PageProps<"/login">) {
  if (await getIdentity()) redirect("/app");
  const params = await searchParams;
  return <AuthForm mode="login" error={typeof params.error === "string" ? params.error : undefined} message={typeof params.message === "string" ? params.message : undefined} />;
}
