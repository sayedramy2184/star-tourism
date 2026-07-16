import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/chauffeur/missions?date=YYYY-MM-DD — missions du chauffeur connecté
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: chauffeur } = await supabase
    .from('chauffeurs').select('id, nom, prenom, vtc_card_numero').eq('profile_id', user.id).maybeSingle()
  if (!chauffeur) return NextResponse.json({ error: 'Aucune fiche chauffeur liée' }, { status: 404 })

  // Plage de dates : ?date=... (un jour) OU ?from=...&to=... (plage, pour « à venir » / « historique »)
  const sp = req.nextUrl.searchParams
  const today = new Date().toISOString().slice(0, 10)
  const dateParam = sp.get('date')
  const from = sp.get('from') || dateParam || today
  const to   = sp.get('to')   || dateParam || today

  // Jours de mise à disposition
  const { data: jours, error: jErr } = await supabase
    .from('jours_mad')
    .select(`
      id, date, jour_semaine, tarif_ht, note,
      heure_debut_reelle, heure_fin_reelle, heures_reelles, heures_sup, montant_total,
      vehicule:vehicules(marque, modele, immatriculation),
      prestation:prestations(
        id, adresse_depart, heure_debut_journee, heure_fin_journee, modele_souhaite, statut, passager_ids,
        dossier:dossiers(numero, valide_at, client:clients(nom, telephone), passagers(id, nom, nationalite))
      )
    `)
    .eq('chauffeur_id', chauffeur.id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  // Transferts
  const { data: transferts, error: tErr } = await supabase
    .from('prestations')
    .select(`
      id, date_debut, heure_depart, adresse_depart, adresse_arrivee, modele_souhaite, statut, passager_ids,
      vehicule:vehicules(marque, modele, immatriculation),
      dossier:dossiers(numero, valide_at, client:clients(nom, telephone), passagers(id, nom, nationalite))
    `)
    .eq('chauffeur_id', chauffeur.id)
    .eq('type', 'transfert')
    .gte('date_debut', from)
    .lte('date_debut', to)
    .order('date_debut', { ascending: true })
    .order('heure_depart', { ascending: true, nullsFirst: true })

  if (jErr || tErr) {
    return NextResponse.json({ error: (jErr ?? tErr)?.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      chauffeur: { id: chauffeur.id, nom: chauffeur.nom, prenom: chauffeur.prenom, vtc_card_numero: chauffeur.vtc_card_numero },
      jours: jours ?? [],
      transferts: transferts ?? [],
    },
  })
}
