import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const date_debut = searchParams.get('date_debut')
  const date_fin   = searchParams.get('date_fin')

  const { data: vehicules, error } = await supabase
    .from('vehicules')
    .select('*, chauffeur:chauffeurs(id, nom, prenom)')
    .neq('statut', 'inactif')
    .order('marque')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si dates fournies, calculer la disponibilité — SANS masquer les véhicules :
  // on les renvoie tous en les marquant indisponibles + une raison.
  if (date_debut && date_fin && vehicules) {
    const { data: occupes } = await supabase
      .from('prestations')
      .select('vehicule_id')
      .not('vehicule_id', 'is', null)
      .lte('date_debut', date_fin)
      .gte('date_fin', date_debut)
      .neq('statut', 'annule')

    const occupesIds = new Set(occupes?.map(p => p.vehicule_id) ?? [])

    const vehiculesWithDispo = vehicules.map(v => {
      const loue = v.mode_acquisition && v.mode_acquisition !== 'propriete'
      let raison: string | null = null
      if (v.date_sortie_parc && v.date_sortie_parc < date_debut)      raison = 'sorti du parc'
      else if (v.date_entree_parc && v.date_entree_parc > date_fin)   raison = 'pas encore au parc'
      else if (loue && v.contrat_fin && v.contrat_fin < date_debut)   raison = 'contrat terminé'
      else if (loue && v.contrat_debut && v.contrat_debut > date_fin) raison = 'hors contrat'
      else if (occupesIds.has(v.id))                                  raison = 'déjà affecté'
      return { ...v, disponible_periode: !raison, indisponible_raison: raison }
    })

    return NextResponse.json({ data: vehiculesWithDispo })
  }

  return NextResponse.json({ data: vehicules })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('vehicules')
    .insert({ ...body, company_id: profile.company_id })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
