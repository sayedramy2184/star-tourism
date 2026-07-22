import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

const JOURS_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const allowed = ['en_attente', 'confirme', 'termine', 'annule']
  if (body.statut && !allowed.includes(body.statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Anti mass-assignment : colonnes immuables / calculées interdites à l'écriture directe
  const FORBIDDEN = ['id', 'company_id', 'dossier_id', 'montant_ht', 'nb_jours', 'created_at', 'ordre']
  const clean: Record<string, any> = Object.fromEntries(Object.entries(body).filter(([k]) => !FORBIDDEN.includes(k)))

  // Prestation libre : le montant suit le tarif fixe (recalculé côté serveur)
  const { data: prest } = await supabase.from('prestations').select('type, dossier_id').eq('id', params.id).single()
  if (prest?.type === 'libre' && body.tarif_fixe_ht !== undefined) {
    clean.montant_ht = Number(body.tarif_fixe_ht) || 0
  }

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
  if (prest?.type === 'libre' && prest.dossier_id) {
    await supabase.rpc('recalc_dossier', { p_dossier_id: prest.dossier_id })
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

// ── DELETE — supprimer une prestation (+ ses jours), recalcule le dossier ──
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: prest } = await supabase.from('prestations').select('dossier_id').eq('id', params.id).single()
  await supabase.from('jours_mad').delete().eq('prestation_id', params.id)
  const { error } = await supabase.from('prestations').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (prest?.dossier_id) await supabase.rpc('recalc_dossier', { p_dossier_id: prest.dossier_id })
  return NextResponse.json({ success: true })
}

// ── PUT — édition complète d'une prestation (détails + tarif) ──
// Gère le recalcul du montant : transfert = tarif fixe ; MAD = somme des jours.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const { data: prest, error: fErr } = await supabase
    .from('prestations').select('id, type, company_id, dossier_id, tarif_journalier_ht').eq('id', params.id).single()
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
    // Modification de la période (prolongation / réduction)
    if (body.date_debut && body.date_fin) { upd.date_debut = body.date_debut; upd.date_fin = body.date_fin }
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

  if (isMad) {
    const tarifJour = (body.tarif_journalier_ht != null && body.tarif_journalier_ht !== '')
      ? Number(body.tarif_journalier_ht)
      : Number(prest.tarif_journalier_ht ?? 0)

    // Régénère les jours si la période change — PRÉSERVE les jours existants (affectations, heures)
    if (body.date_debut && body.date_fin) {
      const { data: existing } = await supabase.from('jours_mad').select('id, date').eq('prestation_id', params.id)
      const existDates = new Set((existing ?? []).map((j: any) => j.date))
      const newDays = eachDayOfInterval({ start: parseISO(body.date_debut), end: parseISO(body.date_fin) }).map(dt => format(dt, 'yyyy-MM-dd'))
      const newSet = new Set(newDays)
      // Supprime les jours hors nouvelle période
      const toDelete = (existing ?? []).filter((j: any) => !newSet.has(j.date)).map((j: any) => j.id)
      if (toDelete.length) await supabase.from('jours_mad').delete().in('id', toDelete)
      // Ajoute les nouveaux jours (au tarif/jour de la prestation)
      const toInsert = newDays.filter(dt => !existDates.has(dt)).map(dt => ({
        company_id: prest.company_id, prestation_id: params.id, date: dt,
        jour_semaine: JOURS_FR[parseISO(dt).getDay()], tarif_ht: tarifJour, statut: 'en_attente',
      }))
      if (toInsert.length) await supabase.from('jours_mad').insert(toInsert)
    }

    // Si le tarif/jour est explicitement modifié → l'appliquer à tous les jours
    if (body.tarif_journalier_ht != null && body.tarif_journalier_ht !== '') {
      const { data: joursRows } = await supabase.from('jours_mad').select('id').eq('prestation_id', params.id)
      await supabase.from('jours_mad').update({ tarif_ht: tarifJour }).eq('prestation_id', params.id)
      for (const j of joursRows ?? []) await supabase.rpc('update_jour_mad_montant', { p_jour_id: j.id })
    }

    await supabase.rpc('recalc_prestation_mad', { p_prestation_id: params.id })
  }

  // Recadre les bornes du dossier si une date a changé
  if (body.date_debut && prest.dossier_id) {
    const { data: allP } = await supabase.from('prestations').select('date_debut, date_fin').eq('dossier_id', prest.dossier_id)
    if (allP && allP.length) {
      const dd = allP.map((x: any) => x.date_debut).reduce((a: string, b: string) => (a < b ? a : b))
      const df = allP.map((x: any) => x.date_fin).reduce((a: string, b: string) => (a > b ? a : b))
      await supabase.from('dossiers').update({ date_debut: dd, date_fin: df }).eq('id', prest.dossier_id)
    }
  }

  const { data } = await supabase.from('prestations').select('*').eq('id', params.id).single()
  return NextResponse.json({ data })
}
