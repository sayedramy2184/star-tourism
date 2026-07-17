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

// ── PUT — édition complète d'une prestation (détails + tarif) ──
// Gère le recalcul du montant : transfert = tarif fixe ; MAD = somme des jours.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const { data: prest, error: fErr } = await supabase
    .from('prestations').select('id, type').eq('id', params.id).single()
  if (fErr || !prest) return NextResponse.json({ error: 'Prestation introuvable' }, { status: 404 })

  const isMad = prest.type === 'mad'

  const upd: Record<string, any> = {
    adresse_depart:      body.adresse_depart ?? null,
    modele_souhaite:     body.modele_souhaite ?? null,
    notes:               body.notes ?? null,
  }

  if (isMad) {
    upd.heure_debut_journee = body.heure_debut_journee || null
    upd.heure_fin_journee   = body.heure_fin_journee || null
    if (body.tarif_journalier_ht != null && body.tarif_journalier_ht !== '') {
      upd.tarif_journalier_ht = Number(body.tarif_journalier_ht)
    }
  } else {
    upd.heure_depart    = body.heure_depart || null
    upd.adresse_arrivee = body.adresse_arrivee ?? null
    if (body.date_debut) { upd.date_debut = body.date_debut; upd.date_fin = body.date_debut }
    const tarif = Number(body.tarif_fixe_ht ?? 0)
    upd.tarif_fixe_ht = tarif
    upd.montant_ht    = tarif   // transfert : le montant = le tarif fixe
  }

  const { error: upErr } = await supabase.from('prestations').update(upd).eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // MAD : si le tarif/jour change, on le répercute sur chaque jour puis on recalcule
  if (isMad && body.tarif_journalier_ht != null && body.tarif_journalier_ht !== '') {
    const tj = Number(body.tarif_journalier_ht)
    const { data: joursRows } = await supabase.from('jours_mad').select('id').eq('prestation_id', params.id)
    await supabase.from('jours_mad').update({ tarif_ht: tj }).eq('prestation_id', params.id)
    for (const j of joursRows ?? []) {
      await supabase.rpc('update_jour_mad_montant', { p_jour_id: j.id })
    }
    await supabase.rpc('recalc_prestation_mad', { p_prestation_id: params.id })
  }

  const { data } = await supabase.from('prestations').select('*').eq('id', params.id).single()
  return NextResponse.json({ data })
}
