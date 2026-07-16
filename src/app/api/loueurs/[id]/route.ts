import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('loueurs')
    .update({
      nom:         body.nom,
      contact_nom: body.contact_nom || null,
      telephone:   body.telephone || null,
      email:       body.email || null,
      notes:       body.notes || null,
    })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  // Détacher les véhicules liés puis supprimer (les paiements partent en cascade)
  await supabase.from('vehicules').update({ loueur_id: null }).eq('loueur_id', params.id)
  const { error } = await supabase.from('loueurs').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
