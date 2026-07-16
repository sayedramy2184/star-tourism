import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/chauffeur/profil — fiche + statistiques du mois du chauffeur connecté
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: c } = await supabase
    .from('chauffeurs')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle()
  if (!c) return NextResponse.json({ error: 'Aucune fiche chauffeur liée' }, { status: 404 })

  // Bornes du mois courant
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [{ data: jours }, { count: nbTransferts }] = await Promise.all([
    supabase.from('jours_mad')
      .select('heures_reelles')
      .eq('chauffeur_id', c.id).gte('date', from).lte('date', to),
    supabase.from('prestations')
      .select('id', { count: 'exact', head: true })
      .eq('chauffeur_id', c.id).eq('type', 'transfert').gte('date_debut', from).lte('date_debut', to),
  ])

  const nbJoursMad = jours?.length ?? 0
  const heuresMois = (jours ?? []).reduce((s, j) => s + Number(j.heures_reelles ?? 0), 0)

  return NextResponse.json({
    data: {
      chauffeur: c,
      stats: {
        missionsMois: nbJoursMad + (nbTransferts ?? 0),
        joursMad: nbJoursMad,
        transferts: nbTransferts ?? 0,
        heuresMois: Math.round(heuresMois * 10) / 10,
      },
    },
  })
}
