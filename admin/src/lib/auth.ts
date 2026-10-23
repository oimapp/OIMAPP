import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { supabaseService } from "./supabase/service";

export type Role = "owner" | "editor" | "support";
export type Admin = { userId: string; email: string; name: string; role: Role };

/** The signed-in admin, or null. */
export async function currentAdmin(): Promise<Admin | null> {
  const { data } = await supabaseServer().auth.getUser();
  if (!data.user) return null;
  const { data: row } = await supabaseService()
    .from("admin_users")
    .select("name, role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!row) return null;
  return { userId: data.user.id, email: data.user.email ?? "", name: row.name, role: row.role as Role };
}

/** Use at the top of every page and action. Sends non-admins to the sign-in page. */
export async function requireAdmin(roles: Role[] = ["owner", "editor", "support"]): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/login?reason=not-admin");
  if (!roles.includes(admin.role)) throw new Error("Your admin role cannot do this. Ask the main admin.");
  return admin;
}

/** Record who did what. */
export async function audit(admin: Admin, action: string, target: string, detail: Record<string, unknown> = {}) {
  await supabaseService().from("audit_log").insert({ actor: admin.userId, action, target, detail });
}
