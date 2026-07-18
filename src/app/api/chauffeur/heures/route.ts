import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST /api/chauffeur/heures — saisie des heures réelles sur un jour MAD
// { jour_id, heure_debut, heure_fin } — chauffeur OU sous-traitant propriétaire du jour
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const account = await getAppAccount(supabase, user.id)
  if (!account) return NextResponse.json({ error: 'Aucun compte lié' }, { status: 404 })

  const { jour_id, heure_debut, heure_fin } = await req.json()
  if (!jour_id) return NextResponse.json({ error: 'jour_id requis' }, { status: 400 })

  // Vérifie que ce jour appartient bien au compte connecté (chauffeur_id OU sous_traitant_id)
  const { data: jour } = await supabase
    .from('jours_mad')
    .select('id, chauffeur_id, sous_traitant_id, prestation_id, heure_debut_reelle, heure_fin_reelle, prestation:prestations(dossier:dossiers(valide_at))')
    .eq('id', jour_id)
    .single()

  const owns = jour && (
    account.type === 'chauffeur'
      ? jour.chauffeur_id === account.id
      : jour.sous_traitant_id === account.id
  )
  if (!owns) return NextResponse.json({ error: 'Mission non autorisée' }, { status: 403 })

  // Verrou UNIQUE : une fois le dossier validé par le dispatch, les heures sont figées.
  // Tant que non validé, le chauffeur peut saisir ET corriger.
  const prest = Array.isArray(jour.prestation) ? jour.prestation[0] : jour.prestation
  const dossier = prest ? (Array.isArray(prest.dossier) ? prest.dossier[0] : prest.dossier) : null
  if (dossier?.valide_at) {
    return NextResponse.json({ error: 'Heures validées par le dispatch — modification impossible.' }, { status: 423 })
  }

  // Écriture + recalculs via le client admin (ownership déjà vérifié ci-dessus)
  const admin = createAdminClient()
  const { error: upErr } = await admin
    .from('jours_mad')
    .update({
      heure_debut_reelle: heure_debut || null,
      heure_fin_reelle: heure_fin || null,
    })
    .eq('id', jour_id)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  await admin.rpc('update_jour_mad_montant', { p_jour_id: jour_id })
  await admin.rpc('recalc_prestation_mad', { p_prestation_id: jour.prestation_id })

  const { data: updated } = await admin
    .from('jours_mad')
    .select('id, heure_debut_reelle, heure_fin_reelle, heures_reelles, heures_sup, montant_total')
    .eq('id', jour_id)
    .single()

  return NextResponse.json({ data: updated })
}
