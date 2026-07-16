import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const date_debut = searchParams.get('date_debut')
  const date_fin   = searchParams.get('date_fin')

  if (!date_debut || !date_fin) {
    return NextResponse.json({ error: 'date_debut et date_fin requis' }, { status: 400 })
  }

  // Chauffeurs actifs
  const { data: chauffeurs } = await supabase
    .from('chauffeurs')
    .select('id, nom, prenom, statut')
    .neq('statut', 'inactif')
    .order('nom')

  // Véhicules actifs
  const { data: vehicules } = await supabase
    .from('vehicules')
    .select('id, marque, modele, immatriculation, categorie, statut')
    .neq('statut', 'inactif')
    .order('marque')

  // Jours MAD dans la période — avec chauffeur et véhicule joinés
  const { data: jours } = await supabase
    .from('jours_mad')
    .select(`
      id, date, jour_semaine, tarif_ht, statut, note,
      chauffeur_id, vehicule_id, sous_traitant_id,
      chauffeur:chauffeurs(id, nom, prenom),
      vehicule:vehicules(id, marque, modele, immatriculation),
      sous_traitant:sous_traitants(id, societe),
      prestation:prestations(
        id, statut, date_debut, date_fin, sous_traitant_id,
        heure_debut_journee, heure_fin_journee,
        adresse_depart, modele_souhaite,
        vehicule:vehicules(id, marque, modele, immatriculation),
        dossier:dossiers(
          id, numero,
          client:clients(id, nom)
        )
      )
    `)
    .gte('date', date_debut)
    .lte('date', date_fin)
    .order('date')

  // Transferts dans la période — avec chauffeur et véhicule joinés
  const { data: transferts } = await supabase
    .from('prestations')
    .select(`
      id, type, date_debut, date_fin, heure_depart, statut,
      adresse_depart, adresse_arrivee, tarif_fixe_ht,
      chauffeur_id, vehicule_id, sous_traitant_id,
      chauffeur:chauffeurs(id, nom, prenom),
      vehicule:vehicules(id, marque, modele, immatriculation),
      sous_traitant:sous_traitants(id, societe),
      dossier:dossiers(
        id, numero,
        client:clients(id, nom)
      )
    `)
    .eq('type', 'transfert')
    .gte('date_debut', date_debut)
    .lte('date_debut', date_fin)
    .order('date_debut')

  return NextResponse.json({
    data: {
      chauffeurs:  chauffeurs  ?? [],
      vehicules:   vehicules   ?? [],
      jours:       jours       ?? [],
      transferts:  transferts  ?? [],
    }
  })
}

// PATCH — affecter un chauffeur à un jour MAD (drag & drop)
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { jour_id, chauffeur_id } = await req.json()

  if (!jour_id || !chauffeur_id) {
    return NextResponse.json({ error: 'jour_id et chauffeur_id requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('jours_mad')
    .update({ chauffeur_id })
    .eq('id', jour_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
