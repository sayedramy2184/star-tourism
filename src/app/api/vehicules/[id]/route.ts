import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('vehicules')
    .select('*, chauffeur:chauffeurs(id, nom, prenom)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Historique des affectations
  const { data: prestations } = await supabase
    .from('prestations')
    .select(`
      id, type, date_debut, date_fin, statut, adresse_depart, adresse_arrivee,
      dossier:dossiers(id, numero, client:clients(nom)),
      chauffeur:chauffeurs(id, nom, prenom)
    `)
    .eq('vehicule_id', params.id)
    .order('date_debut', { ascending: false })
    .limit(50)

  const { data: jours } = await supabase
    .from('jours_mad')
    .select(`
      id, date, statut,
      chauffeur:chauffeurs(id, nom, prenom),
      prestation:prestations(
        id, dossier:dossiers(id, numero, client:clients(nom))
      )
    `)
    .eq('vehicule_id', params.id)
    .order('date', { ascending: false })
    .limit(50)

  return NextResponse.json({ data: { ...data, prestations: prestations ?? [], jours: jours ?? [] } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('vehicules').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('vehicules').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
