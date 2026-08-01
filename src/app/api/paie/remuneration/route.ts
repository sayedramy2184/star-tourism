import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── POST /api/paie/remuneration — modifier la rémunération par unité ──
// body: { updates: [{ kind: 'jour' | 'transfert', id, montant }] }
// montant null / '' => retour au tarif par défaut (200 / 50).
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const updates: any[] = Array.isArray(body.updates) ? body.updates : []
  if (updates.length === 0) return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })

  for (const u of updates) {
    if (!u?.id || (u.kind !== 'jour' && u.kind !== 'transfert')) continue
    const montant = u.montant === '' || u.montant === null || u.montant === undefined ? null : Number(u.montant)
    if (montant != null && (isNaN(montant) || montant < 0)) continue
    const table = u.kind === 'jour' ? 'jours_mad' : 'prestations'
    const { error } = await supabase.from(table).update({ remuneration_ht: montant }).eq('id', u.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
