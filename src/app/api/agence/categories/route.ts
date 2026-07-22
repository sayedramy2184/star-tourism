import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET — catégories de véhicules de la société de l'agence (pour le formulaire)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const account = await getAppAccount(supabase, user.id)
  if (!account || account.type !== 'agence') return NextResponse.json({ error: 'Réservé aux agences' }, { status: 403 })

  const admin = createAdminClient()
  const { data: client } = await admin.from('clients').select('company_id').eq('id', account.id).single()
  if (!client) return NextResponse.json({ data: [] })

  const { data } = await admin
    .from('vehicule_categories')
    .select('id, nom, modeles, ordre')
    .eq('company_id', client.company_id)
    .order('ordre', { ascending: true })
  return NextResponse.json({ data: data ?? [] })
}
