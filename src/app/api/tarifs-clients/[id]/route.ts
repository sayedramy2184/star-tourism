import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// PATCH — modifier un tarif
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const upd: any = {}
  if (body.libelle !== undefined) upd.libelle = String(body.libelle).slice(0, 200)
  if (body.type !== undefined) upd.type = body.type === 'mad' ? 'mad' : 'transfert'
  if (body.categorie !== undefined) upd.categorie = body.categorie || null
  if (body.prix_ht !== undefined) upd.prix_ht = Math.max(0, Number(body.prix_ht) || 0)
  if (body.actif !== undefined) upd.actif = !!body.actif

  const { data, error } = await supabase
    .from('tarifs_clients').update(upd).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE — supprimer un tarif
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('tarifs_clients').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
