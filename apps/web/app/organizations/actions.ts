"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { listOrganizations, createOrganization } from "@/lib/organizations";
import { organizationInput } from "@/lib/organization-input";
import { organizationCookie, rememberOrganization } from "@/lib/organization-cookie";

export async function createOrganizationAction(_state: { error: string }, form: FormData) {
  // This lookup requires authentication before accepting any client input.
  const organizations = await listOrganizations();
  if (!organizations) return { error: "Unable to load organizations. Please try again." };
  if (organizations.length) redirect("/app");
  const input = organizationInput(form);
  if (!input) return { error: "Enter an organization name and a valid lowercase URL using letters, numbers, and single hyphens." };
  const result = await createOrganization(input);
  if (result.error) return { error: result.error };
  if (!result.id) return { error: "Unable to create organization. Please try again." };
  // The RPC created this workspace for the caller; /app revalidates membership.
  await rememberOrganization(result.id);
  redirect("/app");
}

export async function selectOrganization(form: FormData) {
  const organizations = await listOrganizations();
  if (!organizations) redirect("/organizations?error=load");
  if (!organizations.length) redirect("/onboarding/organization");
  const selected = form.get("organization");
  const organization = organizations.find((item) => item.id === selected);
  if (!organization) {
    (await cookies()).delete(organizationCookie);
    redirect("/organizations?error=selection");
  }
  await rememberOrganization(organization.id);
  redirect("/app");
}
