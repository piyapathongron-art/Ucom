import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

// ponytail: only the POS sale screen (offline queue) and other 'use client'
// components that need direct realtime/session access should import this.
// Everything else reads through a Server Component using server.ts.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
