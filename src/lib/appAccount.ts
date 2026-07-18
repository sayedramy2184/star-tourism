// Identifie le type de compte connecté à l'app mobile :
// soit un CHAUFFEUR interne, soit un SOUS-TRAITANT (chacun lié à un profil).

type AnySupabase = {
  from: (t: string) => any
}

export type AppAccount =
  | { type: 'chauffeur'; id: string; nom: string; prenom: string; vtc_card_numero: string | null; label: string }
  | { type: 'sous_traitant'; id: string; societe: string; contact_nom: string | null; label: string }
  | { type: 'agence'; id: string; nom: string; contact_nom: string | null; label: string }

export async function getAppAccount(supabase: AnySupabase, userId: string): Promise<AppAccount | null> {
  const { data: ch } = await supabase
    .from('chauffeurs')
    .select('id, nom, prenom, vtc_card_numero')
    .eq('profile_id', userId)
    .maybeSingle()
  if (ch) {
    return { type: 'chauffeur', id: ch.id, nom: ch.nom, prenom: ch.prenom, vtc_card_numero: ch.vtc_card_numero ?? null, label: `${ch.prenom} ${ch.nom}`.trim() }
  }

  const { data: st } = await supabase
    .from('sous_traitants')
    .select('id, societe, contact_nom')
    .eq('profile_id', userId)
    .maybeSingle()
  if (st) {
    return { type: 'sous_traitant', id: st.id, societe: st.societe, contact_nom: st.contact_nom ?? null, label: st.societe }
  }

  const { data: ag } = await supabase
    .from('clients')
    .select('id, nom, contact_nom, type')
    .eq('profile_id', userId)
    .eq('type', 'agence')
    .maybeSingle()
  if (ag) {
    return { type: 'agence', id: ag.id, nom: ag.nom, contact_nom: ag.contact_nom ?? null, label: ag.nom }
  }

  return null
}
