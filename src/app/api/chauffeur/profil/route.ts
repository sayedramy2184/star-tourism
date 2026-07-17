import { createClient } from '@/lib/supabase/server'
import { getAppAccount } from '@/lib/appAccount'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/chauffeur/profil — fiche + statistiques du mois (chauffeur OU sous-traitant)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const account = await getAppAccount(supabase, user.id)
  if (!account) return NextResponse.json({ error: 'Aucun compte lié' }, { status: 404 })

  const filterCol = account.type === 'chauffeur' ? 'chauffeur_id' : 'sous_traitant_id'

  // Bornes du mois courant
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [{ data: jours }, { count: nbTransferts }] = await Promise.all([
    supabase.from('jours_mad')
      .select('heures_reelles')
      .eq(filterCol, account.id).gte('date', from).lte('date', to),
    supabase.from('prestations')
      .select('id', { count: 'exact', head: true })
      .eq(filterCol, account.id).eq('type', 'transfert').gte('date_debut', from).lte('date_debut', to),
  ])

  const nbJoursMad = jours?.length ?? 0
  const heuresMois = (jours ?? []).reduce((s, j) => s + Number(j.heures_reelles ?? 0), 0)

  const stats = {
    missionsMois: nbJoursMad + (nbTransferts ?? 0),
    joursMad: nbJoursMad,
    transferts: nbTransferts ?? 0,
    heuresMois: Math.round(heuresMois * 10) / 10,
  }

  if (account.type === 'sous_traitant') {
    const { data: st } = await supabase
      .from('sous_traitants').select('*').eq('id', account.id).maybeSingle()
    return NextResponse.json({ data: { type: 'sous_traitant', sousTraitant: st, stats } })
  }

  const { data: c } = await supabase
    .from('chauffeurs').select('*').eq('id', account.id).maybeSingle()
  return NextResponse.json({ data: { type: 'chauffeur', chauffeur: c, stats } })
}
