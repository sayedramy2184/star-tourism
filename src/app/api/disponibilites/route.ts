import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Durée présumée d'un transfert (min) — pour détecter un chevauchement horaire
const TRANSFER_DUR = 60

function toMin(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return h * 60 + (m || 0)
}

// GET /api/disponibilites?from=YYYY-MM-DD&to=YYYY-MM-DD&exclude_prestation=<id>
// Renvoie, par date, les CRÉNEAUX occupés {id, s, e} (minutes) des chauffeurs et véhicules.
// Un chauffeur peut faire plusieurs missions/jour : on ne bloque que si les créneaux se chevauchent.
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const sp = req.nextUrl.searchParams
  const from = sp.get('from')
  const to   = sp.get('to')
  const exclude = sp.get('exclude_prestation')
  if (!from || !to) return NextResponse.json({ error: 'from et to requis' }, { status: 400 })

  type Slot = { id: string; s: number; e: number }
  const chauffeurs: Record<string, Slot[]> = {}
  const vehicules:  Record<string, Slot[]> = {}
  const add = (map: Record<string, Slot[]>, date: string, id: string | null | undefined, s: number, e: number) => {
    if (!id) return
    ;(map[date] ??= []).push({ id, s, e })
  }

  // ── Transferts (créneau = heure_depart .. +TRANSFER_DUR ; sinon journée entière) ──
  let tq = supabase
    .from('prestations')
    .select('id, date_debut, heure_depart, chauffeur_id, vehicule_id')
    .eq('type', 'transfert')
    .neq('statut', 'annule')
    .gte('date_debut', from)
    .lte('date_debut', to)
  if (exclude) tq = tq.neq('id', exclude)
  const { data: transferts, error: tErr } = await tq
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
  for (const t of transferts ?? []) {
    const s = toMin(t.heure_depart)
    const [ds, de] = s == null ? [0, 1440] : [s, Math.min(1440, s + TRANSFER_DUR)]
    add(chauffeurs, t.date_debut, t.chauffeur_id, ds, de)
    add(vehicules,  t.date_debut, t.vehicule_id, ds, de)
  }

  // ── Jours de MAD (créneau = plage journalière de la prestation ; sinon journée entière) ──
  let jq = supabase
    .from('jours_mad')
    .select('date, chauffeur_id, vehicule_id, prestation_id, prestation:prestations(id, vehicule_id, statut, heure_debut_journee, heure_fin_journee)')
    .gte('date', from)
    .lte('date', to)
  if (exclude) jq = jq.neq('prestation_id', exclude)
  const { data: jours, error: jErr } = await jq
  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })
  for (const j of jours ?? []) {
    const prest = Array.isArray(j.prestation) ? j.prestation[0] : j.prestation
    if (prest?.statut === 'annule') continue
    const s = toMin(prest?.heure_debut_journee)
    const e = toMin(prest?.heure_fin_journee)
    const [ds, de] = (s == null || e == null) ? [0, 1440] : [s, e]
    const vehEff = j.vehicule_id ?? prest?.vehicule_id ?? null
    add(chauffeurs, j.date, j.chauffeur_id, ds, de)
    add(vehicules,  j.date, vehEff, ds, de)
  }

  return NextResponse.json({ data: { chauffeurs, vehicules } })
}
