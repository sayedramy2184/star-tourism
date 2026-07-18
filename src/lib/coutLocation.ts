import { differenceInDays, parseISO } from 'date-fns'

export interface LocationInfo {
  loyer_ht: number | null
  loyer_periode: string | null            // 'jour' | 'semaine' | 'mois'
  contrat_debut: string | null
  contrat_fin: string | null
  date_entree_parc: string | null
  date_sortie_parc: string | null
  mode_acquisition?: string | null
}

export interface CoutLocation {
  perJour: number          // loyer ramené au jour
  joursCourus: number      // nb de jours écoulés (début → min(aujourd'hui, fin/sortie))
  coutCouru: number        // ce qui est dû à ce jour
  coutTotalContrat: number | null  // coût total si le contrat est borné (fin connue)
  debut: string | null
  finEffective: string | null      // date jusqu'à laquelle on a couru
  actif: boolean           // location en cours (ni terminée ni sortie)
}

const PAR_JOUR: Record<string, number> = { jour: 1, semaine: 7, mois: 30.44 }
const r2 = (n: number) => Math.round(n * 100) / 100

// Nombre d'unités facturées entre deux dates.
// Location à la JOURNÉE : facturation par tranche de 24h (jours écoulés, min 1 jour).
// Semaine / mois : jours calendaires inclus (début → fin), convertis ensuite via perJour.
function nbUnites(debut: Date, fin: Date, periode: string): number {
  if (fin < debut) return 0
  const jours = differenceInDays(fin, debut)
  return periode === 'jour' ? Math.max(1, jours) : jours + 1
}

// Statut de contrat d'un véhicule loué (null si véhicule en propriété).
// Sert à l'affichage (le véhicule reste visible même après la fin de contrat).
export function contratStatut(
  v: { mode_acquisition?: string | null; contrat_debut?: string | null; contrat_fin?: string | null; date_sortie_parc?: string | null },
  today: Date = new Date(),
): { key: 'a_venir' | 'actif' | 'termine'; label: string; color: string; bg: string } | null {
  if (!v.mode_acquisition || v.mode_acquisition === 'propriete') return null
  const t = today.toISOString().slice(0, 10)
  const fin = v.contrat_fin ?? v.date_sortie_parc ?? null
  if (v.contrat_debut && v.contrat_debut > t) return { key: 'a_venir', label: 'À venir',          color: '#7a5c10', bg: '#fdf3dc' }
  if (fin && fin < t)                          return { key: 'termine', label: 'Contrat terminé',  color: '#8a8478', bg: '#f0eeeb' }
  return { key: 'actif', label: 'Sous contrat', color: '#1e5e3a', bg: '#eaf4ee' }
}

// Calcule le coût couru d'une location. `today` injectable pour les tests / SSR déterministe.
export function coutLocation(v: LocationInfo, today: Date = new Date()): CoutLocation {
  const debut = v.contrat_debut ?? v.date_entree_parc ?? null
  const empty: CoutLocation = {
    perJour: 0, joursCourus: 0, coutCouru: 0, coutTotalContrat: null,
    debut, finEffective: null, actif: false,
  }
  if (!v.loyer_ht || !debut) return empty

  const debutD    = parseISO(debut)
  const finContrat = v.contrat_fin ? parseISO(v.contrat_fin) : null
  const sortie     = v.date_sortie_parc ? parseISO(v.date_sortie_parc) : null

  // Fin d'accumulation = la plus proche entre aujourd'hui, fin de contrat, sortie du parc
  let fin = today
  if (finContrat && finContrat < fin) fin = finContrat
  if (sortie && sortie < fin)         fin = sortie

  const periode     = v.loyer_periode ?? 'mois'
  const perJour     = v.loyer_ht / (PAR_JOUR[periode] ?? 30.44)
  const joursCourus = nbUnites(debutD, fin, periode)
  const coutCouru   = r2(perJour * joursCourus)

  // Coût total du contrat si borné (fin de contrat ou sortie planifiée)
  const finTotale = finContrat ?? sortie
  let coutTotalContrat: number | null = null
  if (finTotale) {
    coutTotalContrat = r2(perJour * nbUnites(debutD, finTotale, periode))
  }

  const actif = (!finContrat || finContrat >= today) && (!sortie || sortie >= today)

  return {
    perJour: r2(perJour), joursCourus, coutCouru, coutTotalContrat,
    debut, finEffective: fin.toISOString().slice(0, 10), actif,
  }
}
