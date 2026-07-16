import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/paiements-loueur — enregistrer un paiement versé à un loueur
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  const montant = Number(body.montant)
  if (!body.loueur_id) return NextResponse.json({ error: 'loueur_id requis' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data, error } = await supabase
    .from('paiements_loueur')
    .insert({
      company_id:    profile.company_id,
      loueur_id:     body.loueur_id,
      montant,
      date_paiement: body.date_paiement || new Date().toISOString().slice(0, 10),
      moyen:         body.moyen || null,
      note:          body.note || null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
