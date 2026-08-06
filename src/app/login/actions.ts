"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ADR 0006: staff type a bare username; we alias it to a fake @ucom.local
// email so Supabase Auth can issue a real session without staff ever
// knowing an email exists.
function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@ucom.local`;
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    redirect("/login?error=invalid");
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
