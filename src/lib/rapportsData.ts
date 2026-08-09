// ─────────────────────────────────────────────
//  Agrégation des rapports (revenus ET coûts réels)
//  Modules : Rentabilité, Financier, Commercial, Opérationnel.
//  Revenus & coûts directs (chauffeurs, sous-traitance) basés sur les
//  dossiers de la période (date_debut). Loyers & occupation flotte calculés
//  séparément sur la fenêtre [from, to].
// ─────────────────────────────────────────────
import { TARIF_MAD_JOUR, TARIF_TRANSFERT } from './salaireChauffeur'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const PAR_JOUR: Record<string, number> = { jour: 1, semaine: 7, mois: 30.44 }

function daysBetween(a: string, b: string): number {
  const d = (Date.parse(b) - Date.parse(a)) / 86400000
  return Math.round(d)
}
// Nombre de jours de chevauchement (inclusif) entre deux plages 'YYYY-MM-DD'
function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  if (start > end) return 0
  return daysBetween(start, end) + 1
}

export interface RapportData {
  periode: { from: string; to: string; jours: number }
  financier: {
    caHt: number; factureHt: number; factureTtc: number; encaisse: number
    enAttente: number; impayes: number; tvaCollectee: number; nbFactures: number
  }
  rentabilite: {
    revenus: number; coutChauffeurs: number; coutSousTraitance: number
    coutLoyers: number; coutTotal: number; margeNette: number; tauxMarge: number
  }
  commercial: {
    nbDossiers: number; panierMoyen: number; caAgence: number; caDirect: number
    nbMad: number; nbTransfert: number
    topClients: { nom: string; ca: number; dossiers: number }[]
  }
  operationnel: {
    activiteChauffeurs: { nom: string; missions: number; cout: number }[]
    flotte: { vehicule: string; immatriculation: string | null; joursOccupes: number; taux: number }[]
    tauxOccupationMoyen: number
  }
  serieMois: { mois: string; ca: number; cout: number; marge: number }[]
  parDossier: { numero: string; client: string; ca: number; cout: number; marge: number }[]
}

export async function computeRapport(supabase: any, from: string, to: string): Promise<RapportData> {
  const joursPeriode = Math.max(1, overlapDays(from, to, from, to))

  const [{ data: dossiers }, { data: factures }, { data: vehicules }, { data: joursOcc }, { data: transOcc }] =
    await Promise.all([
      supabase.from('dossiers').select(`
        id, numero, date_debut, statut,
        client:clients(id, nom, type),
        prestations(
          type, statut, chauffeur_id, sous_traitant_id, st_cout_ht, montant_ht, remuneration_ht,
          chauffeur:chauffeurs(id, nom, prenom),
          jours:jours_mad(chauffeur_id, remuneration_ht, chauffeur:chauffeurs(id, nom, prenom))
        )
      `).gte('date_debut', from).lte('date_debut', to),
      supabase.from('factures').select('statut, montant_ht, montant_ttc, montant_tva, date_emission, date_echeance').gte('date_emission', from).lte('date_emission', to),
      supabase.from('vehicules').select('marque, modele, immatriculation, loyer_ht, loyer_periode, mode_acquisition, contrat_debut, contrat_fin, date_entree_parc, date_sortie_parc').neq('statut', 'inactif'),
      supabase.from('jours_mad').select('date, vehicule_id, prestation:prestations(vehicule_id, statut)').gte('date', from).lte('date', to),
      supabase.from('prestations').select('date_debut, vehicule_id, statut').eq('type', 'transfert').gte('date_debut', from).lte('date_debut', to),
    ])

  const D = dossiers ?? []
  const F = factures ?? []
  const today = new Date().toISOString().slice(0, 10)

  // ── FINANCIER ──
  const factNon = F.filter((f: any) => f.statut !== 'annulee')
  const factureTtc = r2(factNon.reduce((s: number, f: any) => s + (f.montant_ttc ?? 0), 0))
  const factureHt = r2(factNon.reduce((s: number, f: any) => s + (f.montant_ht ?? 0), 0))
  const tvaCollectee = r2(factNon.reduce((s: number, f: any) => s + (f.montant_tva ?? 0), 0))
  const encaisse = r2(F.filter((f: any) => f.statut === 'payee').reduce((s: number, f: any) => s + (f.montant_ttc ?? 0), 0))
  const enAttente = r2(factureTtc - encaisse)
  const impayes = r2(factNon.filter((f: any) => f.statut !== 'payee' && f.date_echeance && f.date_echeance < today)
    .reduce((s: number, f: any) => s + (f.montant_ttc ?? 0), 0))

  // ── DOSSIERS : revenus + coûts directs ──
  let caHt = 0, coutChauffeurs = 0, coutSousTraitance = 0
  let nbMad = 0, nbTransfert = 0, caAgence = 0, caDirect = 0
  const parClient = new Map<string, { nom: string; ca: number; dossiers: number }>()
  const parChauffeur = new Map<string, { nom: string; missions: number; cout: number }>()
  const parMois = new Map<string, { ca: number; cout: number }>()
  const parDossier: RapportData['parDossier'] = []

  for (const d of D as any[]) {
    const pres = (d.prestations ?? []).filter((p: any) => p.statut !== 'annule')
    const revenu = pres.reduce((a: number, p: any) => a + (p.montant_ht ?? 0), 0)

    let coutDossier = 0
    for (const p of pres) {
      if (p.type === 'mad') nbMad++; else nbTransfert++
      // Sous-traitance
      if (p.sous_traitant_id) coutSousTraitance += p.st_cout_ht ?? 0
      if (p.sous_traitant_id) coutDossier += p.st_cout_ht ?? 0
      // Rémunération chauffeur interne
      const addCh = (ch: any, montant: number) => {
        coutChauffeurs += montant; coutDossier += montant
        if (ch) {
          const e = parChauffeur.get(ch.id) ?? { nom: `${ch.prenom} ${ch.nom}`, missions: 0, cout: 0 }
          e.missions += 1; e.cout += montant
          parChauffeur.set(ch.id, e)
        }
      }
      if (p.type === 'transfert') {
        if (p.chauffeur_id) addCh(one(p.chauffeur), p.remuneration_ht ?? TARIF_TRANSFERT)
      } else {
        for (const j of (p.jours ?? [])) {
          if (j.chauffeur_id) addCh(one(j.chauffeur), j.remuneration_ht ?? TARIF_MAD_JOUR)
        }
      }
    }

    caHt += revenu
    const client = one(d.client)
    if (client) {
      const e = parClient.get(client.id) ?? { nom: client.nom, ca: 0, dossiers: 0 }
      e.ca += revenu; e.dossiers += 1
      parClient.set(client.id, e)
      if (client.type === 'agence') caAgence += revenu; else caDirect += revenu
    }
    const mois = d.date_debut?.slice(0, 7)
    if (mois) {
      const m = parMois.get(mois) ?? { ca: 0, cout: 0 }
      m.ca += revenu; m.cout += coutDossier
      parMois.set(mois, m)
    }
    parDossier.push({ numero: d.numero, client: client?.nom ?? '—', ca: r2(revenu), cout: r2(coutDossier), marge: r2(revenu - coutDossier) })
  }

  // ── LOYERS de la période ──
  let coutLoyers = 0
  for (const v of (vehicules ?? []) as any[]) {
    if (!v.loyer_ht || !v.mode_acquisition || v.mode_acquisition === 'propriete') continue
    const cStart = v.contrat_debut ?? v.date_entree_parc
    if (!cStart) continue
    const cEnd = v.contrat_fin ?? v.date_sortie_parc ?? to
    const jours = overlapDays(cStart, cEnd, from, to)
    if (jours <= 0) continue
    const perJour = v.loyer_ht / (PAR_JOUR[v.loyer_periode] ?? 30.44)
    coutLoyers += perJour * jours
  }
  coutLoyers = r2(coutLoyers)

  const coutTotal = r2(coutChauffeurs + coutSousTraitance + coutLoyers)
  caHt = r2(caHt)
  const margeNette = r2(caHt - coutTotal)
  const tauxMarge = caHt > 0 ? r2((margeNette / caHt) * 100) : 0

  // ── OCCUPATION FLOTTE ──
  const occ = new Map<string, Set<string>>() // vehicule_id -> dates
  for (const j of (joursOcc ?? []) as any[]) {
    const prest = one(j.prestation)
    if (prest?.statut === 'annule') continue
    const vid = j.vehicule_id ?? prest?.vehicule_id
    if (!vid || !j.date) continue
    if (!occ.has(vid)) occ.set(vid, new Set())
    occ.get(vid)!.add(j.date)
  }
  for (const t of (transOcc ?? []) as any[]) {
    if (t.statut === 'annule' || !t.vehicule_id || !t.date_debut) continue
    if (!occ.has(t.vehicule_id)) occ.set(t.vehicule_id, new Set())
    occ.get(t.vehicule_id)!.add(t.date_debut)
  }
  // noms des véhicules occupés
  const occIds = Array.from(occ.keys())
  let flotteRows: RapportData['operationnel']['flotte'] = []
  if (occIds.length) {
    const { data: vinfo } = await supabase.from('vehicules').select('id, marque, modele, immatriculation').in('id', occIds)
    const info = new Map<string, any>((vinfo ?? []).map((v: any) => [v.id, v]))
    flotteRows = occIds.map(id => {
      const v = info.get(id)
      const jn = occ.get(id)!.size
      return {
        vehicule: v ? `${v.marque ?? ''} ${v.modele ?? ''}`.trim() : '—',
        immatriculation: v?.immatriculation ?? null,
        joursOccupes: jn,
        taux: r2((jn / joursPeriode) * 100),
      }
    }).sort((a, b) => b.joursOccupes - a.joursOccupes)
  }
  const tauxOccupationMoyen = flotteRows.length
    ? r2(flotteRows.reduce((s, f) => s + f.taux, 0) / flotteRows.length) : 0

  // ── SÉRIE MENSUELLE ──
  const serieMois: RapportData['serieMois'] = []
  {
    const start = new Date(from + 'T00:00:00'); start.setDate(1)
    const end = new Date(to + 'T00:00:00')
    const cur = new Date(start)
    while (cur <= end && serieMois.length < 36) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      const m = parMois.get(key) ?? { ca: 0, cout: 0 }
      serieMois.push({ mois: key, ca: r2(m.ca), cout: r2(m.cout), marge: r2(m.ca - m.cout) })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  const nbDossiers = D.length
  return {
    periode: { from, to, jours: joursPeriode },
    financier: { caHt, factureHt, factureTtc, encaisse, enAttente, impayes, tvaCollectee, nbFactures: factNon.length },
    rentabilite: { revenus: caHt, coutChauffeurs: r2(coutChauffeurs), coutSousTraitance: r2(coutSousTraitance), coutLoyers, coutTotal, margeNette, tauxMarge },
    commercial: {
      nbDossiers, panierMoyen: nbDossiers ? r2(caHt / nbDossiers) : 0,
      caAgence: r2(caAgence), caDirect: r2(caDirect), nbMad, nbTransfert,
      topClients: Array.from(parClient.values()).sort((a, b) => b.ca - a.ca).slice(0, 10).map(c => ({ ...c, ca: r2(c.ca) })),
    },
    operationnel: {
      activiteChauffeurs: Array.from(parChauffeur.values()).sort((a, b) => b.cout - a.cout).map(c => ({ ...c, cout: r2(c.cout) })),
      flotte: flotteRows,
      tauxOccupationMoyen,
    },
    serieMois,
    parDossier: parDossier.sort((a, b) => b.ca - a.ca),
  }
}
