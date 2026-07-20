import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOURS_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']

// PATCH — l'agence modifie UN service (même déjà validé) → repasse « à valider »
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const account = await getAppAccount(supabase, user.id)
  if (!account || account.type !== 'agence') return NextResponse.json({ error: 'Réservé aux agences' }, { status: 403 })

  const admin = createAdminClient()
  const { data: prest } = await admin
    .from('prestations')
    .select('id, dossier_id, company_id, statut, dossier:dossiers(client_id, statut)')
    .eq('id', params.id).single()
  if (!prest) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const dossier = Array.isArray(prest.dossier) ? prest.dossier[0] : prest.dossier
  if (!dossier || dossier.client_id !== account.id) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (dossier.statut === 'termine' || prest.statut === 'termine') {
    return NextResponse.json({ error: 'This service is completed and can no longer be edited.' }, { status: 409 })
  }

  const p = await req.json().catch(() => null)
  if (!p || !p.date_debut) return NextResponse.json({ error: 'A date is required' }, { status: 400 })

  const isMad = p.type === 'mad'
  const df = p.date_fin || p.date_debut

  const { error: upErr } = await admin.from('prestations').update({
    type: p.type,
    date_debut: p.date_debut, date_fin: isMad ? df : p.date_debut,
    heure_depart: !isMad ? (p.heure_depart || null) : null,
    heure_debut_journee: isMad ? (p.heure_debut_journee || null) : null,
    heure_fin_journee: isMad ? (p.heure_fin_journee || null) : null,
    adresse_depart: p.adresse_depart || null,
    adresse_arrivee: !isMad ? (p.adresse_arrivee || null) : null,
    vol_numero: p.vol_numero || null, vol_heure: p.vol_heure || null,
    vol_ville: p.vol_ville || null, vol_terminal: p.vol_terminal || null,
    modele_souhaite: p.modele_souhaite || null,
    nb_passagers: Number(p.nb_passagers) || 1, nb_bagages: Number(p.nb_bagages) || 0,
    // Toute modification agence renvoie en validation dispatch
    validation_statut: 'a_valider', statut: 'en_attente', refus_motif: null,
    tarif_journalier_ht: isMad ? 0 : null, tarif_fixe_ht: !isMad ? 0 : null, montant_ht: 0,
  }).eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Régénère les jours (MAD) — supprime l'ancien planning (affectations comprises, à re-dispatcher)
  await admin.from('jours_mad').delete().eq('prestation_id', params.id)
  if (isMad) {
    try {
      const jours = eachDayOfInterval({ start: parseISO(p.date_debut), end: parseISO(df) }).map(d => ({
        company_id: prest.company_id, prestation_id: params.id,
        date: format(d, 'yyyy-MM-dd'), jour_semaine: JOURS_FR[d.getDay()], tarif_ht: 0, statut: 'en_attente',
      }))
      if (jours.length) await admin.from('jours_mad').insert(jours)
    } catch { /* ignore */ }
  }

  // Recalcule les bornes du dossier depuis toutes ses prestations
  const { data: allP } = await admin.from('prestations').select('date_debut, date_fin').eq('dossier_id', prest.dossier_id)
  if (allP && allP.length) {
    const dd = allP.map(x => x.date_debut).reduce((a, b) => (a < b ? a : b))
    const dfin = allP.map(x => x.date_fin).reduce((a, b) => (a > b ? a : b))
    await admin.from('dossiers').update({ date_debut: dd, date_fin: dfin, soumis_at: new Date().toISOString() }).eq('id', prest.dossier_id)
  }

  return NextResponse.json({ data: { ok: true } })
}
