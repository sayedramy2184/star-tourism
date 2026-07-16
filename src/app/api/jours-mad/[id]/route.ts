import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  // Anti mass-assignment : les montants/heures sont recalculés par la RPC, pas écrits par le client
  const FORBIDDEN = ['id', 'company_id', 'prestation_id', 'created_at', 'heures_reelles', 'heures_sup', 'montant_sup', 'montant_total']
  const clean = Object.fromEntries(Object.entries(body).filter(([k]) => !FORBIDDEN.includes(k)))

  // Met à jour le jour MAD
  const { data, error } = await supabase
    .from('jours_mad')
    .update(clean)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si heures réelles saisies, recalcule les suppléments
  if (body.heure_debut_reelle !== undefined || body.heure_fin_reelle !== undefined) {
    await supabase.rpc('update_jour_mad_montant', { p_jour_id: params.id })

    // Recharge avec les nouvelles valeurs calculées
    const { data: updated } = await supabase
      .from('jours_mad').select('*').eq('id', params.id).single()

    // Recalcule le montant de la prestation
    if (updated) {
      await supabase.rpc('recalc_prestation_mad', { p_prestation_id: data.prestation_id })
    }

    return NextResponse.json({ data: updated ?? data })
  }

  return NextResponse.json({ data })
}
