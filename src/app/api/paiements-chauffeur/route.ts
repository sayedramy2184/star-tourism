import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── GET /api/paiements-chauffeur?chauffeur_id= — liste des versements ──
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const chauffeurId = req.nextUrl.searchParams.get('chauffeur_id')
  if (!chauffeurId) return NextResponse.json({ error: 'chauffeur_id requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('paiements_chauffeur')
    .select('*')
    .eq('chauffeur_id', chauffeurId)
    .order('date_paiement', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST /api/paiements-chauffeur — enregistrer un versement ──
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  const montant = Number(body.montant)
  if (!body.chauffeur_id) return NextResponse.json({ error: 'chauffeur_id requis' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data, error } = await supabase
    .from('paiements_chauffeur')
    .insert({
      company_id:    profile.company_id,
      chauffeur_id:  body.chauffeur_id,
      dossier_id:    body.dossier_id || null,
      montant,
      date_paiement: body.date_paiement || new Date().toISOString().slice(0, 10),
      moyen:         body.moyen || null,
      note:          body.note || null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
