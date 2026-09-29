import { logout } from "@/app/login/actions";
import NavBar from "@/app/_components/NavBar";
import { buildNavLinks } from "@/app/_components/navLinks";
import { createClient } from "@/lib/supabase/server";

export default async function OwnerLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    : { data: null };

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <NavBar links={buildNavLinks(true)} onLogout={logout} displayName={profile?.display_name || "เจ้าของร้าน"} role="เจ้าของร้าน" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
