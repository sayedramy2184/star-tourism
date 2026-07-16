import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('prestations')
    .select(`
      id, type, date_debut, date_fin, montant_ht,
      st_cout_ht, st_marge_ht,
      st_chauffeur_nom, st_chauffeur_telephone,
      st_vehicule_marque, st_vehicule_modele, st_vehicule_immat,
      st_paiement_statut, st_paiement_date, st_paiement_ref,
      dossier:dossiers(
        id, numero,
        client:clients(id, nom)
      )
    `)
    .eq('sous_traitant_id', params.id)
    .order('date_debut', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
