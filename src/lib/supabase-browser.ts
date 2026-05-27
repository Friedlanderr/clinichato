export async function getSupabase() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}