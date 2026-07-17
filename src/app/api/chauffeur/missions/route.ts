import { createClient } from '@/lib/supabase/server'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/chauffeur/missions — missions du compte connecté (chauffeur OU sous-traitant)
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const account = await getAppAccount(supabase, user.id)
  if (!account) return NextResponse.json({ error: 'Aucun compte lié (chauffeur ou sous-traitant)' }, { status: 404 })

  // Colonne de filtrage selon le type de compte
  const filterCol = account.type === 'chauffeur' ? 'chauffeur_id' : 'sous_traitant_id'

  // Plage de dates : ?date=... (un jour) OU ?from=...&to=... (plage)
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
        notes, nb_passagers, nb_bagages,
        st_chauffeur_nom, st_chauffeur_telephone, st_vehicule_marque, st_vehicule_modele, st_vehicule_immat,
        dossier:dossiers(numero, valide_at, notes, client:clients(nom, telephone),
          passagers(id, nom, nationalite, telephone, nb_bagages))
      )
    `)
    .eq(filterCol, account.id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  // Transferts
  const { data: transferts, error: tErr } = await supabase
    .from('prestations')
    .select(`
      id, date_debut, heure_depart, adresse_depart, adresse_arrivee, modele_souhaite, statut, passager_ids,
      notes, nb_passagers, nb_bagages, vol_numero, vol_heure, vol_ville, vol_terminal, vol_arrivee,
      st_chauffeur_nom, st_chauffeur_telephone, st_vehicule_marque, st_vehicule_modele, st_vehicule_immat,
      vehicule:vehicules(marque, modele, immatriculation),
      dossier:dossiers(numero, valide_at, notes, client:clients(nom, telephone),
        passagers(id, nom, nationalite, telephone, nb_bagages))
    `)
    .eq(filterCol, account.id)
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
      account: { type: account.type, label: account.label },
      // Compat : infos chauffeur (fiche « documents de contrôle ») seulement en mode chauffeur
      chauffeur: account.type === 'chauffeur'
        ? { id: account.id, nom: account.nom, prenom: account.prenom, vtc_card_numero: account.vtc_card_numero }
        : null,
      jours: jours ?? [],
      transferts: transferts ?? [],
    },
  })
}
