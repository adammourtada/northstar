"use client";

import { useActionState, useState } from "react";
import { normalizeSlug } from "@/lib/organization-input";
import { createOrganizationAction } from "@/app/organizations/actions";

export function OrganizationForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [editedSlug, setEditedSlug] = useState(false);
  const [state, action, pending] = useActionState(createOrganizationAction, { error: "" });
  const inputClass = "mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    <label className="block text-sm font-medium">Organization name
      <input name="name" required value={name} autoComplete="organization" className={inputClass}
        onChange={(event) => { setName(event.target.value); if (!editedSlug) setSlug(normalizeSlug(event.target.value)); }} />
    </label>
    <label className="block text-sm font-medium">Organization slug
      <input name="slug" required value={slug} pattern="[a-z0-9]+(-[a-z0-9]+)*"
        aria-describedby="slug-help" className={inputClass}
        onChange={(event) => { setEditedSlug(true); setSlug(event.target.value); }} />
    </label>
    <p id="slug-help" className="text-sm text-gray-600">A unique URL name using lowercase letters, numbers, and single hyphens.</p>
    <button type="submit" disabled={pending} className="w-full rounded bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50">
      {pending ? "Creating organization…" : "Create organization"}
    </button>
  </form>;
}
