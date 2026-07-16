import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET — tarifs dédiés d'un client
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('tarifs_clients')
    .select('*')
    .eq('client_id', params.id)
    .eq('actif', true)
    .order('type').order('libelle')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — créer un tarif pour ce client
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  if (!body.libelle?.trim()) return NextResponse.json({ error: 'Libellé requis' }, { status: 400 })
  const type = body.type === 'mad' ? 'mad' : 'transfert'

  const { data, error } = await supabase
    .from('tarifs_clients')
    .insert({
      company_id: profile.company_id,
      client_id: params.id,
      libelle: String(body.libelle).slice(0, 200),
      type,
      categorie: body.categorie || null,
      prix_ht: Math.max(0, Number(body.prix_ht) || 0),
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
