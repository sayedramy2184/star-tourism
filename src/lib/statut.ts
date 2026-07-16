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

// Calcule le statut réel côté client
export function calcStatutClient(prestation: {
  statut: string
  type: string
  date_debut: string
  date_fin: string
  heure_depart?: string | null
  heure_debut_journee?: string | null
  heure_fin_journee?: string | null
}): PrestationStatut {
  const { statut, type, date_debut, date_fin, heure_depart, heure_debut_journee, heure_fin_journee } = prestation

  // Statuts manuels toujours prioritaires
  if (statut === 'annule') return 'annule'
  if (statut === 'termine') return 'termine'

  const now     = new Date()
  const today   = now.toISOString().slice(0, 10)
  const timeNow = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

  if (type === 'transfert') {
    if (!date_debut) return statut as PrestationStatut
    // Terminé uniquement quand la date est dépassée (date_fin = date_debut pour un transfert)
    if (date_debut < today) return 'termine'
    // En cours le jour J dès que l'heure de départ est atteinte
    if (date_debut === today && heure_depart) {
      const [h, m]  = heure_depart.split(':').map(Number)
      const depart  = h * 60 + m
      const current = now.getHours() * 60 + now.getMinutes()
      if (current >= depart) return 'en_cours'
    }
  }

  if (type === 'mad') {
    if (!date_debut || !date_fin) return statut as PrestationStatut
    if (date_fin < today) return 'termine'
    if (date_debut <= today && date_fin >= today) {
      if (heure_debut_journee && heure_fin_journee) {
        if (timeNow >= heure_debut_journee && timeNow <= heure_fin_journee) return 'en_cours'
      } else {
        return 'en_cours'
      }
    }
  }

  // Statuts manuels conservés si pas de règle auto applicable
  return statut as PrestationStatut
}

// Retourne les statuts manuels disponibles
export const STATUTS_MANUELS: PrestationStatut[] = ['en_attente', 'confirme', 'termine', 'annule']
