// ─────────────────────────────────────────────
//  Agrégation de la paie chauffeur (côté serveur)
//  • Global : salaire ACQUIS = prestations TERMINÉES uniquement.
//  • Détail par dossier : toutes les prestations non annulées.
//  Tarifs par défaut 200/50, surchargés par dossier (salaire_chauffeur_dossier).
// ─────────────────────────────────────────────
import { TARIF_MAD_JOUR, TARIF_TRANSFERT, round2 } from './salaireChauffeur'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export interface PaieChauffeurSummary {
  id: string; nom: string; prenom: string; statut: string; interne: boolean
  acquis: number; verse: number; restant: number
}

// Récap global par chauffeur (pour la liste de la section Paie)
export async function loadPaieChauffeurs(supabase: any): Promise<PaieChauffeurSummary[]> {
  const [{ data: chauffeurs }, { data: jours }, { data: transferts }, { data: overrides }, { data: paiements }] =
    await Promise.all([
      supabase.from('chauffeurs').select('id, nom, prenom, statut, interne').neq('statut', 'inactif').order('nom'),
      supabase.from('jours_mad').select('chauffeur_id, statut, prestation:prestations(statut, dossier_id)').not('chauffeur_id', 'is', null),
      supabase.from('prestations').select('chauffeur_id, statut, dossier_id').eq('type', 'transfert').not('chauffeur_id', 'is', null),
      supabase.from('salaire_chauffeur_dossier').select('chauffeur_id, dossier_id, tarif_jour, tarif_transfert'),
      supabase.from('paiements_chauffeur').select('chauffeur_id, montant'),
    ])

  const ov = new Map<string, any>()
  for (const o of overrides ?? []) ov.set(`${o.chauffeur_id}|${o.dossier_id}`, o)
  const tJour = (ch: string, dos: string) => ov.get(`${ch}|${dos}`)?.tarif_jour ?? TARIF_MAD_JOUR
  const tTransf = (ch: string, dos: string) => ov.get(`${ch}|${dos}`)?.tarif_transfert ?? TARIF_TRANSFERT

  const acquis = new Map<string, number>()
  for (const j of jours ?? []) {
    const prest = one(j.prestation)
    if (j.statut !== 'termine' || prest?.statut === 'annule') continue
    acquis.set(j.chauffeur_id, (acquis.get(j.chauffeur_id) ?? 0) + tJour(j.chauffeur_id, prest?.dossier_id))
  }
  for (const t of transferts ?? []) {
    if (t.statut !== 'termine') continue
    acquis.set(t.chauffeur_id, (acquis.get(t.chauffeur_id) ?? 0) + tTransf(t.chauffeur_id, t.dossier_id))
  }
  const verse = new Map<string, number>()
  for (const p of paiements ?? []) verse.set(p.chauffeur_id, (verse.get(p.chauffeur_id) ?? 0) + Number(p.montant ?? 0))

  return (chauffeurs ?? []).map((c: any) => {
    const a = round2(acquis.get(c.id) ?? 0)
    const v = round2(verse.get(c.id) ?? 0)
    return { id: c.id, nom: c.nom, prenom: c.prenom, statut: c.statut, interne: c.interne, acquis: a, verse: v, restant: round2(a - v) }
  })
}

export interface DossierPaie {
  dossierId: string; numero: string; clientNom: string
  nbJours: number; nbJoursTermine: number
  nbTransferts: number; nbTransfertsTermine: number
  tarifJour: number; tarifTransfert: number; hasOverride: boolean; note: string | null
  salaire: number; salaireAcquis: number
  verse: number; restant: number
  paiements: { id: string; montant: number; date_paiement: string; moyen: string | null; note: string | null }[]
}

export interface PaieChauffeurDetail {
  acquis: number; verse: number; restant: number
  dossiers: DossierPaie[]
  versementsHorsDossier: { id: string; montant: number; date_paiement: string; moyen: string | null; note: string | null }[]
}

// Détail complet par dossier pour un chauffeur
export async function loadPaieChauffeurDetail(supabase: any, chauffeurId: string): Promise<PaieChauffeurDetail> {
  const [{ data: jours }, { data: transferts }, { data: overrides }, { data: paiements }] = await Promise.all([
    supabase.from('jours_mad')
      .select('statut, prestation:prestations(statut, dossier_id, dossier:dossiers(numero, client:clients(nom)))')
      .eq('chauffeur_id', chauffeurId),
    supabase.from('prestations')
      .select('statut, dossier_id, dossier:dossiers(numero, client:clients(nom))')
      .eq('type', 'transfert').eq('chauffeur_id', chauffeurId),
    supabase.from('salaire_chauffeur_dossier').select('dossier_id, tarif_jour, tarif_transfert, note').eq('chauffeur_id', chauffeurId),
    supabase.from('paiements_chauffeur').select('id, dossier_id, montant, date_paiement, moyen, note').eq('chauffeur_id', chauffeurId).order('date_paiement', { ascending: false }),
  ])

  const ov = new Map<string, any>()
  for (const o of overrides ?? []) ov.set(o.dossier_id, o)

  const map = new Map<string, DossierPaie>()
  const getD = (dossierId: string, numero: string, clientNom: string): DossierPaie => {
    let d = map.get(dossierId)
    if (!d) {
      const o = ov.get(dossierId)
      d = {
        dossierId, numero, clientNom,
        nbJours: 0, nbJoursTermine: 0, nbTransferts: 0, nbTransfertsTermine: 0,
        tarifJour: o?.tarif_jour ?? TARIF_MAD_JOUR,
        tarifTransfert: o?.tarif_transfert ?? TARIF_TRANSFERT,
        hasOverride: !!o && (o.tarif_jour != null || o.tarif_transfert != null),
        note: o?.note ?? null,
        salaire: 0, salaireAcquis: 0, verse: 0, restant: 0, paiements: [],
      }
      map.set(dossierId, d)
    }
    return d
  }

  for (const j of jours ?? []) {
    const prest = one(j.prestation)
    if (prest?.statut === 'annule' || !prest?.dossier_id) continue
    const dos = one(prest.dossier)
    const d = getD(prest.dossier_id, dos?.numero ?? '—', one(dos?.client)?.nom ?? '—')
    d.nbJours++
    if (j.statut === 'termine') d.nbJoursTermine++
  }
  for (const t of transferts ?? []) {
    if (t.statut === 'annule' || !t.dossier_id) continue
    const dos = one(t.dossier)
    const d = getD(t.dossier_id, dos?.numero ?? '—', one(dos?.client)?.nom ?? '—')
    d.nbTransferts++
    if (t.statut === 'termine') d.nbTransfertsTermine++
  }

  // Versements : rattachés à un dossier (ventilés) ou non
  const horsDossier: PaieChauffeurDetail['versementsHorsDossier'] = []
  for (const p of paiements ?? []) {
    const row = { id: p.id, montant: Number(p.montant ?? 0), date_paiement: p.date_paiement, moyen: p.moyen, note: p.note }
    const d = p.dossier_id ? map.get(p.dossier_id) : null
    if (d) { d.paiements.push(row); d.verse = round2(d.verse + row.montant) }
    else horsDossier.push(row)
  }

  const dossiers = Array.from(map.values()).map(d => {
    d.salaire = round2(d.nbJours * d.tarifJour + d.nbTransferts * d.tarifTransfert)
    d.salaireAcquis = round2(d.nbJoursTermine * d.tarifJour + d.nbTransfertsTermine * d.tarifTransfert)
    d.restant = round2(d.salaire - d.verse)
    return d
  }).sort((a, b) => b.numero.localeCompare(a.numero))

  const acquis = round2(dossiers.reduce((s, d) => s + d.salaireAcquis, 0))
  const verse = round2((paiements ?? []).reduce((s: number, p: any) => s + Number(p.montant ?? 0), 0))
  return { acquis, verse, restant: round2(acquis - verse), dossiers, versementsHorsDossier: horsDossier }
}
