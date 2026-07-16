import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/chauffeur/heures — le chauffeur saisit ses heures réelles sur un jour MAD
// { jour_id, heure_debut, heure_fin }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: chauffeur } = await supabase
    .from('chauffeurs').select('id').eq('profile_id', user.id).maybeSingle()
  if (!chauffeur) return NextResponse.json({ error: 'Aucune fiche chauffeur liée' }, { status: 404 })

  const { jour_id, heure_debut, heure_fin } = await req.json()
  if (!jour_id) return NextResponse.json({ error: 'jour_id requis' }, { status: 400 })

  // Vérifie que ce jour appartient bien au chauffeur connecté
  const { data: jour } = await supabase
    .from('jours_mad')
    .select('id, chauffeur_id, prestation_id')
    .eq('id', jour_id)
    .single()

  if (!jour || jour.chauffeur_id !== chauffeur.id) {
    return NextResponse.json({ error: 'Mission non autorisée' }, { status: 403 })
  }

  const { error: upErr } = await supabase
    .from('jours_mad')
    .update({
      heure_debut_reelle: heure_debut || null,
      heure_fin_reelle: heure_fin || null,
    })
    .eq('id', jour_id)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Recalcule suppléments (heures sup) + montant de la prestation
  await supabase.rpc('update_jour_mad_montant', { p_jour_id: jour_id })
  await supabase.rpc('recalc_prestation_mad', { p_prestation_id: jour.prestation_id })

  const { data: updated } = await supabase
    .from('jours_mad')
    .select('id, heure_debut_reelle, heure_fin_reelle, heures_reelles, heures_sup, montant_total')
    .eq('id', jour_id)
    .single()

  return NextResponse.json({ data: updated })
}
