import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const STATUTS = ['brouillon', 'emise', 'envoyee', 'payee', 'en_retard', 'annulee']

// ── GET /api/factures/[id] ────────────────────
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('factures')
    .select(`
      *,
      client:clients(*),
      dossier:dossiers(id, numero),
      lignes:lignes_facture(*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
  if (data.lignes) data.lignes.sort((a: any, b: any) => a.ordre - b.ordre)
  return NextResponse.json({ data })
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ── PATCH /api/factures/[id] — édition (lignes, brouillon) ou statut/notes ─
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  const { data: facture } = await supabase
    .from('factures').select('statut, taux_tva').eq('id', params.id).single()
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  // ── Édition complète avec lignes — brouillon uniquement ──
  if (Array.isArray(body.lignes)) {
    if (facture.statut !== 'brouillon') {
      return NextResponse.json({ error: 'Une facture émise ne peut plus être modifiée. Créez un avoir.' }, { status: 403 })
    }
    const lignes = body.lignes
      .filter((l: any) => (l.designation ?? '').trim() || Number(l.prix_unitaire_ht) > 0)
      .map((l: any, i: number) => ({
        ordre: i + 1,
        designation: String(l.designation ?? '').trim().slice(0, 300) || 'Prestation',
        description: l.description ? String(l.description).slice(0, 500) : null,
        reference: l.reference ? String(l.reference).slice(0, 120) : null,
        quantite: Math.max(0, Number(l.quantite) || 1),
        prix_unitaire_ht: round2(Math.max(0, Number(l.prix_unitaire_ht) || 0)),
      }))
    if (lignes.length === 0) return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 })

    const tauxTva = body.taux_tva != null ? Number(body.taux_tva) : (facture.taux_tva ?? 10)
    const montantHt = round2(lignes.reduce((s: number, l: any) => s + round2(l.quantite * l.prix_unitaire_ht), 0))
    const montantTva = round2(montantHt * tauxTva / 100)
    const montantTtc = round2(montantHt + montantTva)

    await supabase.from('lignes_facture').delete().eq('facture_id', params.id)
    const { error: lErr } = await supabase.from('lignes_facture').insert(lignes.map((l: any) => ({ ...l, facture_id: params.id })))
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })

    const upd: any = { taux_tva: tauxTva, montant_ht: montantHt, montant_tva: montantTva, montant_ttc: montantTtc, updated_at: new Date().toISOString() }
    if (body.client_id) upd.client_id = body.client_id
    if (body.date_echeance) upd.date_echeance = body.date_echeance
    if (body.notes !== undefined) upd.notes = body.notes || null

    const { data, error } = await supabase.from('factures').update(upd).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // ── Mise à jour simple (allow-list — plus de mass-assignment) ──
  if (body.statut && !STATUTS.includes(body.statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }
  const upd: any = { updated_at: new Date().toISOString() }
  if (body.statut) upd.statut = body.statut
  if (body.notes !== undefined) upd.notes = body.notes || null
  if (body.date_echeance) upd.date_echeance = body.date_echeance

  const { data, error } = await supabase.from('factures').update(upd).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── DELETE /api/factures/[id] — brouillon uniquement ─
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: facture } = await supabase
    .from('factures').select('statut, numero').eq('id', params.id).single()
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  if (facture.statut !== 'brouillon') {
    return NextResponse.json({
      error: `La facture ${facture.numero} est émise — suppression impossible. Annulez-la plutôt.`,
    }, { status: 403 })
  }

  const { error } = await supabase.from('factures').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
