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

export interface TarifOverride {
  tarif_jour: number | null
  tarif_transfert: number | null
}

// Tarifs effectifs pour un dossier (override sinon défaut)
export function tarifsFor(override?: TarifOverride | null) {
  return {
    tarifJour: override?.tarif_jour ?? TARIF_MAD_JOUR,
    tarifTransfert: override?.tarif_transfert ?? TARIF_TRANSFERT,
  }
}

// Salaire = jours × tarif/jour + transferts × tarif/transfert
export function montantSalaire(nbJours: number, nbTransferts: number, override?: TarifOverride | null) {
  const { tarifJour, tarifTransfert } = tarifsFor(override)
  return round2(nbJours * tarifJour + nbTransferts * tarifTransfert)
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}
