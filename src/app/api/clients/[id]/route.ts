import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHAMPS = [
  'type', 'nom', 'contact_nom', 'email', 'telephone',
  'adresse', 'code_postal', 'ville', 'pays', 'numero_tva', 'notes',
] as const

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('clients').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

// PATCH — modifier la fiche client
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json().catch(() => ({}))

  const { data: actuel } = await supabase
    .from('clients').select('id, type, profile_id').eq('id', params.id).single()
  if (!actuel) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  if (body.type && !['particulier', 'entreprise', 'agence'].includes(body.type)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }
  // Un compte portail est lié à une agence : on ne peut pas changer le type sans révoquer l'accès
  if (actuel.profile_id && body.type && body.type !== 'agence') {
    return NextResponse.json(
      { error: "Ce client a un accès portail agence. Révoquez l'accès avant de changer son type." },
      { status: 409 },
    )
  }

  const clean: Record<string, any> = {}
  for (const k of CHAMPS) {
    if (k in body) clean[k] = body[k] === '' ? null : body[k]
  }
  if (clean.nom !== undefined && !String(clean.nom || '').trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clients').update(clean).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE — supprimer un client (refusé s'il a des dossiers ou un accès portail)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: cl } = await supabase.from('clients').select('id, profile_id').eq('id', params.id).single()
  if (!cl) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (cl.profile_id) {
    return NextResponse.json({ error: "Ce client a un accès portail. Révoquez-le d'abord." }, { status: 409 })
  }

  const { count } = await supabase
    .from('dossiers').select('id', { count: 'exact', head: true }).eq('client_id', params.id)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: `Impossible : ce client a ${count} dossier(s).` }, { status: 409 })
  }

  const { error } = await supabase.from('clients').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
