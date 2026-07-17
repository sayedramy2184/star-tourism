// ─────────────────────────────────────────────
//  src/lib/statut.ts
//  Calcul et affichage des statuts de prestations
// ─────────────────────────────────────────────

export type PrestationStatut =
  | 'en_attente'
  | 'confirme'
  | 'en_cours'
  | 'termine'
  | 'annule'

export interface StatutInfo {
  label:  string
  color:  string
  bg:     string
  border: string
  dot:    string
  manual: boolean   // true = modifiable manuellement
  auto:   boolean   // true = calculé automatiquement
}

export const STATUT_MAP: Record<PrestationStatut, StatutInfo> = {
  en_attente: {
    label:  'En attente',
    color:  '#7a5c10',
    bg:     '#fdf3dc',
    border: 'rgba(122,92,16,0.25)',
    dot:    '#7a5c10',
    manual: true,
    auto:   false,
  },
  confirme: {
    label:  'Confirmé',
    color:  '#1e5e3a',
    bg:     '#eaf4ee',
    border: 'rgba(30,94,58,0.25)',
    dot:    '#1e5e3a',
    manual: true,
    auto:   false,
  },
  en_cours: {
    label:  'En cours',
    color:  '#1e3f70',
    bg:     '#e8eef8',
    border: 'rgba(30,63,112,0.25)',
    dot:    '#1e3f70',
    manual: false,
    auto:   true,
  },
  termine: {
    label:  'Terminé',
    color:  '#8a8478',
    bg:     '#f5f2ed',
    border: 'rgba(138,132,120,0.25)',
    dot:    '#c2bdb4',
    manual: true,   // peut être forcé manuellement…
    auto:   true,   // …ou calculé quand la date_fin est dépassée
  },
  annule: {
    label:  'Annulé',
    color:  '#9e2a2a',
    bg:     '#faeaea',
    border: 'rgba(158,42,42,0.25)',
    dot:    '#9e2a2a',
    manual: true,
    auto:   false,
  },
}

// Calcule le statut réel côté client.
// Règle simple, prévisible : la mission avance toute seule selon la DATE.
//  - avant la mission        → statut manuel (en attente / confirmé)
//  - pendant (aujourd'hui)   → EN COURS (toute la journée)
//  - après la date de fin    → TERMINÉ
export function calcStatutClient(prestation: {
  statut: string
  type: string
  date_debut: string
  date_fin: string
  heure_depart?: string | null
  heure_debut_journee?: string | null
  heure_fin_journee?: string | null
}): PrestationStatut {
  const { statut, type, date_debut, date_fin } = prestation

  // Statuts manuels toujours prioritaires
  if (statut === 'annule') return 'annule'
  if (statut === 'termine') return 'termine'

  // Date du jour en heure LOCALE (cohérent avec les dates stockées 'YYYY-MM-DD')
  const now = new Date()
  const p2  = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`

  if (type === 'transfert') {
    if (!date_debut) return statut as PrestationStatut
    if (date_debut < today) return 'termine'        // date passée
    if (date_debut === today) return 'en_cours'     // aujourd'hui = en cours toute la journée
    return statut as PrestationStatut               // futur → statut manuel
  }

  if (type === 'mad') {
    if (!date_debut || !date_fin) return statut as PrestationStatut
    if (date_fin < today) return 'termine'                            // période terminée
    if (date_debut <= today && date_fin >= today) return 'en_cours'   // en cours (multi-jours)
    return statut as PrestationStatut                                 // futur → statut manuel
  }

  return statut as PrestationStatut
}

// Retourne les statuts manuels disponibles
export const STATUTS_MANUELS: PrestationStatut[] = ['en_attente', 'confirme', 'termine', 'annule']
