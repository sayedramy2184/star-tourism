import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/dispatch?from=YYYY-MM-DD&to=YYYY-MM-DD
// Retourne toutes les missions (prestations) chevauchant la période.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const now = new Date()
  const from = req.nextUrl.searchParams.get('from') || now.toISOString().slice(0, 10)
  const toDefault = new Date(now.getTime() + 6 * 864e5).toISOString().slice(0, 10)
  const to = req.nextUrl.searchParams.get('to') || toDefault

  const { data, error } = await supabase
    .from('prestations')
    .select(`
      id, type, statut, date_debut, date_fin,
      heure_depart, heure_debut_journee, heure_fin_journee,
      adresse_depart, adresse_arrivee, modele_souhaite, montant_ht,
      nb_passagers, nb_bagages, passager_ids,
      affectation_differee, chauffeur_id, sous_traitant_id, st_chauffeur_nom, st_vehicule_marque,
      vol_numero, vol_heure, vol_ville, vol_terminal, vol_arrivee,
      dossier:dossiers(id, numero, client:clients(nom), passagers(id, nom, nationalite)),
      vehicule:vehicules(marque, modele, immatriculation, categorie),
      chauffeur:chauffeurs(nom, prenom),
      sous_traitant:sous_traitants(societe),
      jours:jours_mad(chauffeur_id, sous_traitant_id)
    `)
    .in('type', ['mad', 'transfert'])   // exclut les prestations libres (hors transport)
    .lte('date_debut', to)
    .gte('date_fin', from)
    .order('date_debut', { ascending: true })
    .order('heure_depart', { ascending: true, nullsFirst: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], periode: { from, to } })
}
