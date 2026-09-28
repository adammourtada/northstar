import "server-only";
import { cookies } from "next/headers";

export const organizationCookie = "northstar-organization";

export async function rememberOrganization(id: string) {
  (await cookies()).set(organizationCookie, id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}
