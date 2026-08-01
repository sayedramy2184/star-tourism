// ─────────────────────────────────────────────
//  Calcul du salaire chauffeur
//  Tarifs par défaut (rémunération chauffeur, distincts des tarifs clients) :
//    • MAD       = 200 € / jour affecté
//    • Transfert = 50 € / transfert affecté
//  Ces tarifs sont modifiables PAR DOSSIER (table salaire_chauffeur_dossier).
//  Le récap GLOBAL ne compte que les prestations TERMINÉES.
//  Le détail PAR DOSSIER compte toutes les prestations non annulées.
// ─────────────────────────────────────────────

export const TARIF_MAD_JOUR = 200
export const TARIF_TRANSFERT = 50

// Rémunération effective d'une unité (override sinon défaut selon le type)
export function remuJour(remuneration_ht: number | null | undefined) {
  return remuneration_ht ?? TARIF_MAD_JOUR
}
export function remuTransfert(remuneration_ht: number | null | undefined) {
  return remuneration_ht ?? TARIF_TRANSFERT
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}
