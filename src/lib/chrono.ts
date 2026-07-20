// Tri chronologique commun (date puis heure) pour toutes les prestations/missions.
// Fonctionne pour un transfert (date_debut + heure_depart), une MAD (date_debut +
// heure_debut_journee) ou un jour MAD (date + prestation.heure_debut_journee).

function hhmm(t?: string | null): string {
  return t ? t.slice(0, 5) : '00:00'
}

export function chronoKey(x: any): string {
  const date = x?.date_debut ?? x?.date ?? '9999-12-31'
  const prest = Array.isArray(x?.prestation) ? x.prestation[0] : x?.prestation
  const heure =
    x?.heure ??
    x?.heure_depart ??
    x?.heure_debut_journee ??
    prest?.heure_debut_journee ??
    prest?.heure_depart ??
    '00:00'
  return `${date}T${hhmm(heure)}`
}

// Comparateur ascendant (plus tôt en premier)
export function byChrono(a: any, b: any): number {
  return chronoKey(a).localeCompare(chronoKey(b))
}
