import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST /api/prestations/[id]/valider
// { action: 'valider' | 'refuser', tarif?: number, motif?: string }
// Valide (avec prix) ou refuse une prestation soumise par une agence.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json().catch(() => ({}))
  const action = body.action

  const { data: prest, error: fErr } = await supabase
    .from('prestations').select('id, type, dossier_id').eq('id', params.id).single()
  if (fErr || !prest) return NextResponse.json({ error: 'Prestation introuvable' }, { status: 404 })

  if (action === 'refuser') {
    const { error } = await supabase.from('prestations')
      .update({ validation_statut: 'refusee', refus_motif: body.motif || null, statut: 'annule' })
      .eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: { ok: true } })
  }

  if (action === 'valider') {
    const tarif = Number(body.tarif) || 0
    const isMad = prest.type === 'mad'

    if (isMad) {
      const { error } = await supabase.from('prestations')
        .update({ validation_statut: 'validee', statut: 'confirme', tarif_journalier_ht: tarif })
        .eq('id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // Applique le tarif/jour à chaque jour puis recalcule prestation + dossier
      await supabase.from('jours_mad').update({ tarif_ht: tarif }).eq('prestation_id', params.id)
      await supabase.rpc('recalc_prestation_mad', { p_prestation_id: params.id })
    } else {
      const { error } = await supabase.from('prestations')
        .update({ validation_statut: 'validee', statut: 'confirme', tarif_fixe_ht: tarif, montant_ht: tarif })
        .eq('id', params.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      // recalc_dossier se déclenche via le trigger sur montant_ht (migration 014)
    }
    return NextResponse.json({ data: { ok: true } })
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}
