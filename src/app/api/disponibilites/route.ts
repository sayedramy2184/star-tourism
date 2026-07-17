import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/disponibilites?from=YYYY-MM-DD&to=YYYY-MM-DD&exclude_prestation=<id>
// Renvoie, par date, les chauffeurs et véhicules DÉJÀ occupés (sur d'autres missions).
// Sert à afficher la disponibilité lors de l'affectation par jour.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')
  const exclude = sp.get('exclude_prestation')
  if (!from || !to) return NextResponse.json({ error: 'from et to requis' }, { status: 400 })

  const chauffeurs: Record<string, string[]> = {}
  const vehicules:  Record<string, string[]> = {}
  const add = (map: Record<string, string[]>, date: string, id?: string | null) => {
    if (!id) return
    ;(map[date] ??= [])
    if (!map[date].includes(id)) map[date].push(id)
  }

  // ── Transferts (une journée) ──
  let tq = supabase
    .from('prestations')
    .select('id, date_debut, chauffeur_id, vehicule_id')
    .eq('type', 'transfert')
    .neq('statut', 'annule')
    .gte('date_debut', from)
    .lte('date_debut', to)
  if (exclude) tq = tq.neq('id', exclude)
  const { data: transferts, error: tErr } = await tq
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  for (const t of transferts ?? []) {
    add(chauffeurs, t.date_debut, t.chauffeur_id)
    add(vehicules,  t.date_debut, t.vehicule_id)
  }

  // ── Jours de MAD (par date) ──
  let jq = supabase
    .from('jours_mad')
    .select('date, chauffeur_id, vehicule_id, prestation_id, prestation:prestations(id, vehicule_id, statut)')
    .gte('date', from)
    .lte('date', to)
  if (exclude) jq = jq.neq('prestation_id', exclude)
  const { data: jours, error: jErr } = await jq
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })
  for (const j of jours ?? []) {
    const prest = Array.isArray(j.prestation) ? j.prestation[0] : j.prestation
    if (prest?.statut === 'annule') continue
    const vehEff = j.vehicule_id ?? prest?.vehicule_id ?? null   // véhicule effectif du jour
    add(chauffeurs, j.date, j.chauffeur_id)
    add(vehicules,  j.date, vehEff)
  }

  return NextResponse.json({ data: { chauffeurs, vehicules } })
}
