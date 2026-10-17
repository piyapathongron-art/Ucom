"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/safe-return";
import { loginErrorPath } from "@/lib/login-return";

// ADR 0006: staff type a bare username; we alias it to a fake @ucom.local
// email so Supabase Auth can issue a real session without staff ever
// knowing an email exists.
function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@ucom.local`;
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeReturnPath(formData.get("next"));

  if (!username || !password) {
    redirect(loginErrorPath(next, "missing"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    redirect(loginErrorPath(next, "invalid"));
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
