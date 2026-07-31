import { createClient } from "@supabase/supabase-js";

// Server-side only client — uses the service_role key, which bypasses RLS.
// NEVER import this file into a "use client" component or expose this key
// to the browser. For client-side reads, create a separate client using
// NEXT_PUBLIC_SUPABASE_ANON_KEY instead.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);