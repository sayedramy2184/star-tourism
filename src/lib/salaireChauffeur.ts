// ─────────────────────────────────────────────
//  Calcul du salaire chauffeur
//  Tarifs fixes (rémunération chauffeur, distincts des tarifs clients) :
//    • MAD       = 200 € / jour affecté
//    • Transfert = 50 € / transfert affecté
//  Les prestations annulées ne sont jamais comptées.
// ─────────────────────────────────────────────

export const TARIF_MAD_JOUR = 200
export const TARIF_TRANSFERT = 50

export function calcSalaire(nbJoursMad: number, nbTransferts: number) {
  const montantMad = nbJoursMad * TARIF_MAD_JOUR
  const montantTransfert = nbTransferts * TARIF_TRANSFERT
  return {
    nbJoursMad,
    nbTransferts,
    montantMad,
    montantTransfert,
    total: montantMad + montantTransfert,
  }
}
