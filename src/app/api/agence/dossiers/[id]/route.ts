import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'
import { eachDayOfInterval, parseISO, format } from 'date-fns'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JOURS_FR = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']

async function ctx(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const account = await getAppAccount(supabase, user.id)
  if (!account || account.type !== 'agence') return { error: NextResponse.json({ error: 'Réservé aux agences' }, { status: 403 }) }

  const admin = createAdminClient()
  const { data: dossier } = await admin
    .from('dossiers')
    .select('id, client_id, company_id, statut, origine, prestations(id, validation_statut)')
    .eq('id', id).single()
  if (!dossier || dossier.client_id !== account.id) return { error: NextResponse.json({ error: 'Introuvable' }, { status: 404 }) }

  // Modifiable seulement tant qu'aucune prestation n'est validée/refusée (100 % en attente)
  const editable = (dossier.prestations ?? []).every((p: any) => p.validation_statut === 'a_valider')
  return { admin, account, dossier, editable }
}

// PATCH — remplace les prestations + passagers d'une demande encore en attente
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const c = await ctx(params.id)
  if (c.error) return c.error
  if (!c.editable) return NextResponse.json({ error: 'This request is already being processed and can no longer be edited.' }, { status: 409 })
  const { admin, dossier } = c

  const body = await req.json().catch(() => null)
  const prestations: any[] = Array.isArray(body?.prestations) ? body.prestations : []
  const passagers: any[] = Array.isArray(body?.passagers) ? body.passagers : []
  if (prestations.length === 0) return NextResponse.json({ error: 'At least one service is required' }, { status: 400 })

  // Purge de l'existant
  const { data: oldP } = await admin.from('prestations').select('id').eq('dossier_id', dossier.id)
  for (const op of oldP ?? []) await admin.from('jours_mad').delete().eq('prestation_id', op.id)
  await admin.from('prestations').delete().eq('dossier_id', dossier.id)
  await admin.from('passagers').delete().eq('dossier_id', dossier.id)

  const company_id = dossier.company_id
  const dates = prestations.flatMap(p => [p.date_debut, p.date_fin || p.date_debut])
  const date_debut = dates.reduce((a, b) => (a < b ? a : b))
  const date_fin = dates.reduce((a, b) => (a > b ? a : b))
  await admin.from('dossiers').update({ date_debut, date_fin, notes: body.notes || null, soumis_at: new Date().toISOString() }).eq('id', dossier.id)

  if (passagers.length > 0) {
    const rows = passagers.filter(p => (p.nom || '').trim()).map(p => ({
      company_id, dossier_id: dossier.id, nom: String(p.nom).trim(),
      nationalite: p.nationalite || null, telephone: p.telephone || null, nb_bagages: Number(p.nb_bagages) || 0,
    }))
    if (rows.length) await admin.from('passagers').insert(rows)
  }

  let ordre = 1
  for (const p of prestations) {
    const isMad = p.type === 'mad'
    const df = p.date_fin || p.date_debut
    const { data: presta } = await admin.from('prestations').insert({
      company_id, dossier_id: dossier.id, ordre: ordre++, type: p.type,
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
      statut: 'en_attente', validation_statut: 'a_valider',
      tarif_journalier_ht: isMad ? 0 : null, tarif_fixe_ht: !isMad ? 0 : null, montant_ht: 0,
    }).select('id').single()
    if (isMad && presta) {
      try {
        const jours = eachDayOfInterval({ start: parseISO(p.date_debut), end: parseISO(df) }).map(d => ({
          company_id, prestation_id: presta.id, date: format(d, 'yyyy-MM-dd'), jour_semaine: JOURS_FR[d.getDay()], tarif_ht: 0, statut: 'en_attente',
        }))
        if (jours.length) await admin.from('jours_mad').insert(jours)
      } catch { /* ignore */ }
    }
  }
  return NextResponse.json({ data: { ok: true } })
}

// DELETE — annuler une demande encore en attente
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const c = await ctx(params.id)
  if (c.error) return c.error
  if (!c.editable) return NextResponse.json({ error: 'This request is already being processed and can no longer be cancelled.' }, { status: 409 })
  const { admin, dossier } = c

  const { data: oldP } = await admin.from('prestations').select('id').eq('dossier_id', dossier.id)
  for (const op of oldP ?? []) await admin.from('jours_mad').delete().eq('prestation_id', op.id)
  await admin.from('prestations').delete().eq('dossier_id', dossier.id)
  await admin.from('passagers').delete().eq('dossier_id', dossier.id)
  const { error } = await admin.from('dossiers').delete().eq('id', dossier.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
