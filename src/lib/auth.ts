import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/anmelden");
  return { supabase, user };
}
export async function isAdmin(email?: string | null) {
  return !!email && (process.env.ADMIN_EMAILS ?? "").split(",").map(v => v.trim().toLowerCase()).includes(email.toLowerCase());
}
