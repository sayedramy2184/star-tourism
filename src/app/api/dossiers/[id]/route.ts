import { createClient } from '@/lib/supabase/server'
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

// ── GET /api/dossiers/[id] ────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  // Désactiver le cache pour toujours avoir les données fraîches

  const { data, error } = await supabase
    .from('dossiers')
    .select(`
      *,
      client:clients(*),
      prestations(
        *,
        vehicule:vehicules(id, marque, modele, immatriculation, categorie),
        vehicule_ext:vehicules_ext(id, marque, modele, immatriculation, loueur, cout_ht),
        chauffeur:chauffeurs(id, nom, prenom, telephone),
        sous_traitant:sous_traitants(id, societe, contact_nom, telephone),
        jours:jours_mad(
          *, chauffeur:chauffeurs(id, nom, prenom),
          vehicule:vehicules(id, marque, modele, immatriculation)
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  if (data.prestations) {
    data.prestations.sort((a: any, b: any) => a.ordre - b.ordre)
    data.prestations.forEach((p: any) => {
      if (p.jours) p.jours.sort((a: any, b: any) => a.date.localeCompare(b.date))
    })
  }

  return NextResponse.json({ data })
}

// ── PATCH /api/dossiers/[id] ──────────────────
// Gère aussi la validation du dossier

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json()

  // Récupère le dossier actuel
  const { data: current } = await supabase
    .from('dossiers')
    .select('statut, valide_at')
    .eq('id', params.id)
    .single()

  // Action de validation — passe à "en_cours"
  if (body._action === 'valider') {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('dossiers')
      .update({
        statut:     'en_cours',
        valide_at:  new Date().toISOString(),
        valide_by:  user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('statut', 'en_attente') // seulement si en attente
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Dossier déjà validé ou introuvable' }, { status: 400 })
    return NextResponse.json({ data })
  }

  // Modification normale — interdit de changer le statut manuellement
  // (seuls _action:valider et l'auto-termination peuvent changer le statut)
  const { _action, statut: _statut, ...updateData } = body

  const { data, error } = await supabase
    .from('dossiers')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── DELETE /api/dossiers/[id] ─────────────────
// Bloqué si le dossier est validé (en_cours ou termine)

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()

  // Vérifie le statut avant suppression
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('statut, numero')
    .eq('id', params.id)
    .single()

  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  if (dossier.statut === 'en_cours' || dossier.statut === 'termine') {
    return NextResponse.json({
      error: `Le dossier ${dossier.numero} est validé — suppression impossible.`
    }, { status: 403 })
  }

  const { error } = await supabase.from('dossiers').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
