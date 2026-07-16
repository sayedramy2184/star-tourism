import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MOYENS = ['virement', 'cb', 'especes', 'cheque', 'autre']

// GET — liste des paiements d'une facture
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('paiements')
    .select('*')
    .eq('facture_id', params.id)
    .order('date_paiement', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST — enregistrer un paiement
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const { data: facture } = await supabase
    .from('factures').select('id, montant_ttc, statut').eq('id', params.id).single()
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (facture.statut === 'annulee') return NextResponse.json({ error: 'Facture annulée' }, { status: 400 })

  const body = await req.json()
  const montant = Math.round((Number(body.montant) || 0) * 100) / 100
  if (montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  const moyen = MOYENS.includes(body.moyen) ? body.moyen : 'autre'

  const { data: paiement, error } = await supabase
    .from('paiements')
    .insert({
      company_id: profile.company_id,
      facture_id: params.id,
      montant,
      date_paiement: body.date_paiement || new Date().toISOString().slice(0, 10),
      moyen,
      reference: body.reference || null,
      notes: body.notes || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Recalcule le reste dû → statut
  const { data: paies } = await supabase.from('paiements').select('montant').eq('facture_id', params.id)
  const totalPaye = (paies ?? []).reduce((s, p) => s + (p.montant ?? 0), 0)
  const solde = Math.round((facture.montant_ttc - totalPaye) * 100) / 100

  let newStatut = facture.statut
  if (solde <= 0) newStatut = 'payee'
  else if (facture.statut === 'payee') newStatut = 'emise' // paiement retiré/insuffisant
  else if (facture.statut === 'brouillon') newStatut = 'emise' // un paiement émet de fait la facture

  if (newStatut !== facture.statut) {
    await supabase.from('factures').update({ statut: newStatut, updated_at: new Date().toISOString() }).eq('id', params.id)
  }

  return NextResponse.json({ data: { paiement, totalPaye, solde, statut: newStatut } })
}
