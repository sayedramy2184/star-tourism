import { createClient } from '@supabase/supabase-js'

// Client Supabase avec la clé service-role — SERVEUR UNIQUEMENT.
// Contourne la RLS et donne accès à l'API admin (auth.admin.*).
// Ne jamais importer dans un composant client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Configuration Supabase service-role manquante (SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
