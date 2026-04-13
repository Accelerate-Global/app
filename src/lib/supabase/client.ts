"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
