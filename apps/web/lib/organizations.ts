import "server-only";
import { requireIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/organization-input";

export async function listOrganizations(): Promise<Organization[] | null> {
  const identity = await requireIdentity();
  try {
    const supabase = await createClient();
    // RLS allows co-member reads, so explicitly filter to the validated caller.
    const { data: memberships, error } = await supabase.from("organization_members")
      .select("organization_id, role").eq("user_id", identity.id);
    if (error || !memberships) return null;
    if (!memberships.length) return [];
    const { data: organizations, error: organizationError } = await supabase.from("organizations")
      .select("id, name, slug").in("id", memberships.map((item) => item.organization_id))
      .order("name");
    if (organizationError || !organizations) return null;
    return organizations.flatMap((organization) => {
      const membership = memberships.find((item) => item.organization_id === organization.id);
      return membership ? [{ ...organization, role: membership.role } as Organization] : [];
    });
  } catch {
    // Never surface provider messages, query details, or credentials.
    return null;
  }
}

export async function createOrganization(input: { name: string; slug: string }) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: input.name, p_slug: input.slug,
    });
    if (error?.code === "23505") return { error: "This organization URL is already in use." };
    if (error || typeof data !== "string") return { error: "Unable to create organization. Please try again." };
    return { id: data };
  } catch {
    return { error: "Unable to create organization. Please try again." };
  }
}
