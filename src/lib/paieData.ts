// ─────────────────────────────────────────────
//  Agrégation de la paie chauffeur (côté serveur)
//  Rémunération PAR UNITÉ : chaque jour MAD et chaque transfert a son tarif
//  (jours_mad.remuneration_ht / prestations.remuneration_ht ; NULL = défaut 200/50).
//  • Global : salaire ACQUIS = unités TERMINÉES (date passée) uniquement.
//  • Détail par dossier : toutes les unités non annulées + liste éditable.
// ─────────────────────────────────────────────
import { TARIF_MAD_JOUR, TARIF_TRANSFERT, remuJour, remuTransfert, round2 } from './salaireChauffeur'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const todayStr = () => new Date().toISOString().slice(0, 10)
// Une unité est « terminée » quand sa date est passée (strictement avant aujourd'hui)
const estTermine = (date: string | null | undefined) => !!date && date < todayStr()

export interface PaieChauffeurSummary {
  id: string; nom: string; prenom: string; statut: string; interne: boolean
  acquis: number; verse: number; restant: number
}

// Récap global par chauffeur (pour la liste de la section Paie)
export async function loadPaieChauffeurs(supabase: any): Promise<PaieChauffeurSummary[]> {
  const [{ data: chauffeurs }, { data: jours }, { data: transferts }, { data: paiements }] =
    await Promise.all([
      supabase.from('chauffeurs').select('id, nom, prenom, statut, interne').neq('statut', 'inactif').order('nom'),
      supabase.from('jours_mad').select('chauffeur_id, date, remuneration_ht, prestation:prestations(statut)').not('chauffeur_id', 'is', null),
      supabase.from('prestations').select('chauffeur_id, date_debut, statut, remuneration_ht').eq('type', 'transfert').not('chauffeur_id', 'is', null),
      supabase.from('paiements_chauffeur').select('chauffeur_id, montant'),
    ])

  const acquis = new Map<string, number>()
  for (const j of jours ?? []) {
    const prest = one(j.prestation)
    if (prest?.statut === 'annule' || !estTermine(j.date)) continue
    acquis.set(j.chauffeur_id, (acquis.get(j.chauffeur_id) ?? 0) + remuJour(j.remuneration_ht))
  }
  for (const t of transferts ?? []) {
    if (t.statut === 'annule' || !estTermine(t.date_debut)) continue
    acquis.set(t.chauffeur_id, (acquis.get(t.chauffeur_id) ?? 0) + remuTransfert(t.remuneration_ht))
  }
  const verse = new Map<string, number>()
  for (const p of paiements ?? []) verse.set(p.chauffeur_id, (verse.get(p.chauffeur_id) ?? 0) + Number(p.montant ?? 0))

  return (chauffeurs ?? []).map((c: any) => {
    const a = round2(acquis.get(c.id) ?? 0)
    const v = round2(verse.get(c.id) ?? 0)
    return { id: c.id, nom: c.nom, prenom: c.prenom, statut: c.statut, interne: c.interne, acquis: a, verse: v, restant: round2(a - v) }
  })
}

export interface PaieUnite {
  id: string            // jour_mad.id ou prestation.id
  kind: 'jour' | 'transfert'
  date: string
  label: string         // ex "Lun. 12/07" ou "CDG → Ritz"
  tarif: number         // rémunération effective
  isDefault: boolean    // true si tarif = défaut (pas d'override)
  termine: boolean
}

export interface DossierPaie {
  dossierId: string; numero: string; clientNom: string
  dateDebut: string | null; dateFin: string | null
  nbJours: number; nbTransferts: number
  salaire: number; salaireAcquis: number
  verse: number; restant: number
  unites: PaieUnite[]
  paiements: { id: string; montant: number; date_paiement: string; moyen: string | null; note: string | null }[]
}

export interface PaieChauffeurDetail {
  acquis: number; verse: number; restant: number
  dossiers: DossierPaie[]
  versementsHorsDossier: { id: string; montant: number; date_paiement: string; moyen: string | null; note: string | null }[]
}

function fmtJJ(date: string) {
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}

// Détail complet par dossier pour un chauffeur
export async function loadPaieChauffeurDetail(supabase: any, chauffeurId: string): Promise<PaieChauffeurDetail> {
  const [{ data: jours }, { data: transferts }, { data: paiements }] = await Promise.all([
    supabase.from('jours_mad')
      .select('id, date, jour_semaine, remuneration_ht, prestation:prestations(statut, dossier_id, dossier:dossiers(numero, client:clients(nom)))')
      .eq('chauffeur_id', chauffeurId),
    supabase.from('prestations')
      .select('id, date_debut, statut, remuneration_ht, adresse_depart, adresse_arrivee, dossier_id, dossier:dossiers(numero, client:clients(nom))')
      .eq('type', 'transfert').eq('chauffeur_id', chauffeurId),
    supabase.from('paiements_chauffeur').select('id, dossier_id, montant, date_paiement, moyen, note').eq('chauffeur_id', chauffeurId).order('date_paiement', { ascending: false }),
  ])

  const map = new Map<string, DossierPaie>()
  const getD = (dossierId: string, numero: string, clientNom: string): DossierPaie => {
    let d = map.get(dossierId)
    if (!d) {
      d = {
        dossierId, numero, clientNom, dateDebut: null, dateFin: null,
        nbJours: 0, nbTransferts: 0, salaire: 0, salaireAcquis: 0, verse: 0, restant: 0,
        unites: [], paiements: [],
      }
      map.set(dossierId, d)
    }
    return d
  }
  const bump = (d: DossierPaie, date: string) => {
    if (!d.dateDebut || date < d.dateDebut) d.dateDebut = date
    if (!d.dateFin || date > d.dateFin) d.dateFin = date
  }

  for (const j of jours ?? []) {
    const prest = one(j.prestation)
    if (prest?.statut === 'annule' || !prest?.dossier_id) continue
    const dos = one(prest.dossier)
    const d = getD(prest.dossier_id, dos?.numero ?? '—', one(dos?.client)?.nom ?? '—')
    d.nbJours++
    bump(d, j.date)
    d.unites.push({
      id: j.id, kind: 'jour', date: j.date,
      label: `${j.jour_semaine ?? ''} ${fmtJJ(j.date)}`.trim(),
      tarif: remuJour(j.remuneration_ht), isDefault: j.remuneration_ht == null, termine: estTermine(j.date),
    })
  }
  for (const t of transferts ?? []) {
    if (t.statut === 'annule' || !t.dossier_id) continue
    const dos = one(t.dossier)
    const d = getD(t.dossier_id, dos?.numero ?? '—', one(dos?.client)?.nom ?? '—')
    d.nbTransferts++
    if (t.date_debut) bump(d, t.date_debut)
    const route = [t.adresse_depart, t.adresse_arrivee].filter(Boolean).join(' → ')
    d.unites.push({
      id: t.id, kind: 'transfert', date: t.date_debut,
      label: `${t.date_debut ? fmtJJ(t.date_debut) + ' · ' : ''}${route || 'Transfert'}`,
      tarif: remuTransfert(t.remuneration_ht), isDefault: t.remuneration_ht == null, termine: estTermine(t.date_debut),
    })
  }

  // Versements ventilés par dossier
  const horsDossier: PaieChauffeurDetail['versementsHorsDossier'] = []
  for (const p of paiements ?? []) {
    const row = { id: p.id, montant: Number(p.montant ?? 0), date_paiement: p.date_paiement, moyen: p.moyen, note: p.note }
    const d = p.dossier_id ? map.get(p.dossier_id) : null
    if (d) { d.paiements.push(row); d.verse = round2(d.verse + row.montant) }
    else horsDossier.push(row)
  }

  const dossiers = Array.from(map.values()).map(d => {
    d.unites.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    d.salaire = round2(d.unites.reduce((s, u) => s + u.tarif, 0))
    d.salaireAcquis = round2(d.unites.filter(u => u.termine).reduce((s, u) => s + u.tarif, 0))
    d.restant = round2(d.salaire - d.verse)
    return d
  }).sort((a, b) => b.numero.localeCompare(a.numero))

  const acquis = round2(dossiers.reduce((s, d) => s + d.salaireAcquis, 0))
  const verse = round2((paiements ?? []).reduce((s: number, p: any) => s + Number(p.montant ?? 0), 0))
  return { acquis, verse, restant: round2(acquis - verse), dossiers, versementsHorsDossier: horsDossier }
}
