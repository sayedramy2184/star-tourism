import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('chauffeurs')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Historique des jours MAD
  const { data: jours } = await supabase
    .from('jours_mad')
    .select(`
      *,
      prestation:prestations(
        id, type, date_debut, date_fin, adresse_depart, adresse_arrivee,
        dossier:dossiers(id, numero, client:clients(nom))
      )
    `)
    .eq('chauffeur_id', params.id)
    .order('date', { ascending: false })
    .limit(50)

  // Historique des transferts
  const { data: transferts } = await supabase
    .from('prestations')
    .select(`
      *,
      dossier:dossiers(id, numero, client:clients(nom))
    `)
    .eq('chauffeur_id', params.id)
    .eq('type', 'transfert')
    .order('date_debut', { ascending: false })
    .limit(50)

  return NextResponse.json({ data: { ...data, jours: jours ?? [], transferts: transferts ?? [] } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('chauffeurs')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Récupère le compte lié pour le révoquer (évite un compte Auth orphelin toujours actif)
  const { data: chauffeur } = await supabase
    .from('chauffeurs').select('profile_id').eq('id', params.id).single()

  const { error } = await supabase.from('chauffeurs').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Supprime le compte Auth associé (cascade le profil)
  if (chauffeur?.profile_id) {
    try {
      const admin = createAdminClient()
      await admin.auth.admin.deleteUser(chauffeur.profile_id)
    } catch { /* best-effort — la fiche est déjà supprimée */ }
  }

  return NextResponse.json({ success: true })
}
