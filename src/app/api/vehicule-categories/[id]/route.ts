import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const upd: Record<string, any> = {}
  if (body.nom !== undefined) upd.nom = String(body.nom).trim()
  if (body.modeles !== undefined) upd.modeles = Array.isArray(body.modeles) ? body.modeles : []
  if (body.ordre !== undefined) upd.ordre = Number(body.ordre) || 0

  const { data, error } = await supabase
    .from('vehicule_categories').update(upd).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('vehicule_categories').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
