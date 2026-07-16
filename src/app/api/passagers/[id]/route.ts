import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const upd: any = {}
  if (body.nom !== undefined) upd.nom = String(body.nom).slice(0, 200)
  if (body.nationalite !== undefined) upd.nationalite = body.nationalite ? String(body.nationalite).slice(0, 60) : null
  if (body.telephone !== undefined) upd.telephone = body.telephone || null
  if (body.nb_bagages !== undefined) upd.nb_bagages = Math.max(0, Number(body.nb_bagages) || 0)
  if (body.notes !== undefined) upd.notes = body.notes || null

  const { data, error } = await supabase.from('passagers').update(upd).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('passagers').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
