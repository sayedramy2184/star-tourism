import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100 }

// Nombre de jours de règlement depuis un libellé « Paiement à 30 jours »
function joursReglement(conditions: string | null | undefined): number {
  if (!conditions) return 30
  if (/imm[ée]diat/i.test(conditions)) return 0
  const m = conditions.match(/(\d+)/)
  return m ? parseInt(m[1], 10) : 30
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── GET /api/factures — liste ─────────────────
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('factures')
    .select('*, client:clients(id, nom), dossier:dossiers(id, numero), paiements(montant)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST /api/factures — créer depuis un dossier ─
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()

  // Paramètres société (taux TVA, conditions de règlement)
  const { data: societe } = await supabase
    .from('societe_parametres')
    .select('taux_tva, conditions_paiement')
    .eq('company_id', profile.company_id)
    .maybeSingle()

  const dateEmission = new Date().toISOString().slice(0, 10)
  const dateEcheance = body.date_echeance || addDaysISO(dateEmission, joursReglement(societe?.conditions_paiement))
  const tauxTva = body.taux_tva != null ? Number(body.taux_tva) : (societe?.taux_tva ?? 10)

  let dossierId: string | null = null
  let clientId: string
  let lignesInput: any[]

  if (body.dossier_id) {
    // ── Création depuis un dossier ──
    const { data: existante } = await supabase
      .from('factures').select('id, numero').eq('dossier_id', body.dossier_id).neq('statut', 'annulee').maybeSingle()
    if (existante) return NextResponse.json({ data: existante, existing: true })

    const { data: dossier, error: dErr } = await supabase
      .from('dossiers')
      .select(`
        id, numero, client_id, montant_ht,
        prestations(
          id, ordre, type, date_debut, date_fin, nb_jours,
          adresse_depart, adresse_arrivee, modele_souhaite, montant_ht, libelle, notes, statut,
          jours:jours_mad(id)
        )
      `)
      .eq('id', body.dossier_id)
      .single()
    if (dErr || !dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

    dossierId = dossier.id
    clientId = dossier.client_id
    const prestations = [...(dossier.prestations ?? [])]
      .filter((p: any) => p.statut !== 'annule')   // pas de ligne pour une prestation annulée
      .sort((a: any, b: any) => a.ordre - b.ordre)
    lignesInput = prestations.map((p: any, i: number) => {
      const isMad = p.type === 'mad'
      const isLibre = p.type === 'libre'
      const nbj = isMad ? (p.jours?.length || p.nb_jours || 1) : 1
      const quantite = isMad ? nbj : 1
      const pu = round2(quantite > 0 ? (p.montant_ht ?? 0) / quantite : (p.montant_ht ?? 0))
      const trajet = [p.adresse_depart, p.adresse_arrivee].filter(Boolean).join(' → ')
      return {
        ordre: i + 1,
        designation: isLibre ? (p.libelle || 'Prestation') : isMad ? 'Mise à disposition avec chauffeur' : 'Transfert privé avec chauffeur',
        description: isLibre
          ? [p.date_debut, p.notes || null].filter(Boolean).join(' · ') || null
          : [`${p.date_debut} → ${p.date_fin}`, p.modele_souhaite, trajet || null].filter(Boolean).join(' · '),
        reference: `${dossier.numero} · P-${String(p.ordre).padStart(2, '0')}`,
        quantite,
        prix_unitaire_ht: pu,
      }
    })
  } else if (body.client_id && Array.isArray(body.lignes) && body.lignes.length > 0) {
    // ── Création manuelle (client + lignes libres) ──
    clientId = body.client_id
    lignesInput = body.lignes
      .filter((l: any) => (l.designation ?? '').trim() || Number(l.prix_unitaire_ht) > 0)
      .map((l: any, i: number) => ({
        ordre: i + 1,
        designation: String(l.designation ?? '').trim().slice(0, 300) || 'Prestation',
        description: l.description ? String(l.description).slice(0, 500) : null,
        reference: l.reference ? String(l.reference).slice(0, 120) : null,
        quantite: Math.max(0, Number(l.quantite) || 1),
        prix_unitaire_ht: round2(Math.max(0, Number(l.prix_unitaire_ht) || 0)),
      }))
    if (lignesInput.length === 0) return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 })
  } else {
    return NextResponse.json({ error: 'dossier_id, ou (client_id + lignes) requis' }, { status: 400 })
  }

  // Numéro via séquence légale (sans réutilisation)
  const { data: numero, error: nErr } = await supabase
    .rpc('next_numero', { p_company_id: profile.company_id, p_type: 'facture', p_prefix: 'FAC' })
  if (nErr || !numero) return NextResponse.json({ error: 'Numérotation impossible' }, { status: 500 })

  const montantHt  = round2(lignesInput.reduce((s, l) => s + round2(l.quantite * l.prix_unitaire_ht), 0))
  const montantTva = round2(montantHt * tauxTva / 100)
  const montantTtc = round2(montantHt + montantTva)

  const { data: facture, error: fErr } = await supabase
    .from('factures')
    .insert({
      company_id: profile.company_id,
      numero,
      type: 'facture',
      dossier_id: dossierId,
      client_id: clientId,
      statut: 'brouillon',
      date_emission: dateEmission,
      date_echeance: dateEcheance,
      montant_ht: montantHt,
      taux_tva: tauxTva,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      notes: body.notes ?? null,
    })
    .select()
    .single()

  if (fErr || !facture) {
    console.error('FACTURE INSERT ERROR:', JSON.stringify(fErr))
    return NextResponse.json({ error: fErr?.message ?? 'Erreur création facture' }, { status: 500 })
  }

  // Insertion des lignes
  const { error: lErr } = await supabase
    .from('lignes_facture')
    .insert(lignesInput.map(l => ({ ...l, facture_id: facture.id })))

  if (lErr) {
    // Rollback best-effort de la facture
    await supabase.from('factures').delete().eq('id', facture.id)
    console.error('LIGNES INSERT ERROR:', JSON.stringify(lErr))
    return NextResponse.json({ error: lErr.message }, { status: 500 })
  }

  return NextResponse.json({ data: facture })
}
