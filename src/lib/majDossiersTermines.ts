// ─────────────────────────────────────────────
//  Clôture automatique des dossiers « terminés »
//
//  Le statut « Terminé » d'une prestation est VIRTUEL : il se calcule
//  depuis la date (cf. calcStatutClient), jamais stocké en base. Le trigger
//  SQL sync_dossier_statut (migration 004) ne voit donc jamais ce « terminé »
//  et ne clôture pas le dossier. Cette fonction comble le manque, côté serveur,
//  en recalculant depuis les dates — à appeler au chargement de la liste des
//  dossiers (même principe que /api/factures/maj-retards).
// ─────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'

// Date du jour en fuseau Europe/Paris (aligné sur les dates 'YYYY-MM-DD' stockées).
function todayParis(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Une prestation est « close » si elle est annulée ou si sa date est passée.
// MAD → sur la date de fin ; transfert / libre → sur la date de début.
function prestationCloturee(
  p: { type: string; statut: string; date_debut: string | null; date_fin: string | null },
  today: string,
): boolean {
  // Statuts explicitement fermés (marqués à la main / par le dispatch)
  if (p.statut === 'annule' || p.statut === 'termine') return true
  // Sinon, close si la date est passée (terminé « virtuel »)
  if (p.type === 'mad') return !!p.date_fin && p.date_fin < today
  return !!p.date_debut && p.date_debut < today
}

// Passe à « termine » tout dossier « en_cours » dont toutes les prestations sont
// closes (avec au moins une prestation réelle non annulée). Retourne le nb clôturés.
export async function majDossiersTermines(admin: SupabaseClient): Promise<number> {
  const today = todayParis()

  const { data: dossiers, error } = await admin
    .from('dossiers')
    .select('id, prestations(type, statut, date_debut, date_fin)')
    .eq('statut', 'en_cours')
  if (error || !dossiers) return 0

  const aCloturer: string[] = []
  for (const d of dossiers as any[]) {
    const pres = d.prestations ?? []
    if (pres.length === 0) continue
    const tousClos = pres.every((p: any) => prestationCloturee(p, today))
    const auMoinsUnReel = pres.some((p: any) => p.statut !== 'annule')
    if (tousClos && auMoinsUnReel) aCloturer.push(d.id)
  }

  if (aCloturer.length) {
    await admin.from('dossiers')
      .update({ statut: 'termine', updated_at: new Date().toISOString() })
      .in('id', aCloturer)
  }
  return aCloturer.length
}
