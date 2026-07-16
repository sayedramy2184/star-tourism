import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const allowed = ['en_attente', 'confirme', 'termine', 'annule']
  if (body.statut && !allowed.includes(body.statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Anti mass-assignment : colonnes immuables / calculées interdites à l'écriture directe
  const FORBIDDEN = ['id', 'company_id', 'dossier_id', 'montant_ht', 'nb_jours', 'created_at', 'ordre']
  const clean = Object.fromEntries(Object.entries(body).filter(([k]) => !FORBIDDEN.includes(k)))

  const { data, error } = await supabase
    .from('prestations')
    .update(clean)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('PRESTATION PATCH ERROR:', JSON.stringify(error))
    console.error('BODY:', JSON.stringify(body))
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prestations').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}
