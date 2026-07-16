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

  // Si dates fournies, vérifier disponibilité
  if (date_debut && date_fin && vehicules) {
    // Exclure les véhicules hors parc sur la période :
    //  - sortis du parc avant le début de la mission
    //  - pas encore entrés dans le parc à la fin de la mission
    // (comparaison lexicographique sûre sur des dates ISO 'YYYY-MM-DD')
    const dansLeParc = vehicules.filter(v => {
      const sortiAvantPeriode    = v.date_sortie_parc && v.date_sortie_parc < date_debut
      const pasEncoreEntre       = v.date_entree_parc && v.date_entree_parc > date_fin
      return !sortiAvantPeriode && !pasEncoreEntre
    })

    const { data: occupes } = await supabase
      .from('prestations')
      .select('vehicule_id')
      .not('vehicule_id', 'is', null)
      .lte('date_debut', date_fin)
      .gte('date_fin', date_debut)
      .neq('statut', 'annule')

    const occupesIds = new Set(occupes?.map(p => p.vehicule_id) ?? [])

    const vehiculesWithDispo = dansLeParc.map(v => ({
      ...v,
      disponible_periode: !occupesIds.has(v.id)
    }))

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
