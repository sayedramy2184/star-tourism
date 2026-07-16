import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/paiements-sous-traitant?sous_traitant_id=... — liste des versements
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const stId = req.nextUrl.searchParams.get('sous_traitant_id')
  if (!stId) return NextResponse.json({ error: 'sous_traitant_id requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('paiements_sous_traitant')
    .select('id, montant, date_paiement, moyen, note')
    .eq('sous_traitant_id', stId)
    .order('date_paiement', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/paiements-sous-traitant — enregistrer un versement à un sous-traitant
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  const montant = Number(body.montant)
  if (!body.sous_traitant_id) return NextResponse.json({ error: 'sous_traitant_id requis' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data, error } = await supabase
    .from('paiements_sous_traitant')
    .insert({
      company_id:       profile.company_id,
      sous_traitant_id: body.sous_traitant_id,
      montant,
      date_paiement:    body.date_paiement || new Date().toISOString().slice(0, 10),
      moyen:            body.moyen || null,
      note:             body.note || null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
