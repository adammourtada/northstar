export function normalizeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function isValidSlug(value: string) {
  return value === value.trim() && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

export function organizationInput(form: FormData) {
  const name = form.get("name");
  const slug = form.get("slug");
  if (typeof name !== "string" || !name.trim() ||
      typeof slug !== "string" || !isValidSlug(slug.trim())) return null;
  return { name: name.trim(), slug: slug.trim() };
}

export type Organization = { id: string; name: string; slug: string; role: string };

export function organizationDestination(organizations: Organization[], selected?: string) {
  if (!organizations.length) return { redirect: "/onboarding/organization" } as const;
  const organization = organizations.find((item) => item.id === selected)
    ?? (organizations.length === 1 ? organizations[0] : undefined);
  if (!organization) return { redirect: "/organizations" } as const;
  return { organization } as const;
}
