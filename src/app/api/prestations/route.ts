import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  const { dossier_id, ...prestationData } = body

  if (!dossier_id) return NextResponse.json({ error: 'dossier_id requis' }, { status: 400 })

  // Calcul montant HT
  let montant_ht = 0
  if (prestationData.type === 'transfert' || prestationData.type === 'libre') {
    montant_ht = prestationData.tarif_fixe_ht ?? 0
  } else if (prestationData.type === 'mad') {
    montant_ht = (prestationData.jours ?? []).reduce((s: number, j: any) => s + (j.tarif_ht ?? 0), 0)
  }

  // Ordre de la nouvelle prestation
  const { count } = await supabase
    .from('prestations')
    .select('*', { count: 'exact', head: true })
    .eq('dossier_id', dossier_id)

  const { jours, ...prestaFields } = prestationData

  const { data: prestation, error } = await supabase
    .from('prestations')
    .insert({
      ...prestaFields,
      dossier_id,
      company_id: profile.company_id,
      ordre: (count ?? 0) + 1,
      montant_ht,
      vehicule_id:     prestaFields.vehicule_id     ?? null,
      vehicule_ext_id: prestaFields.vehicule_ext_id ?? null,
      chauffeur_id:    prestaFields.chauffeur_id    ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Jours MAD
  if (prestationData.type === 'mad' && jours?.length > 0) {
    await supabase.from('jours_mad').insert(
      jours.map((j: any) => ({
        company_id:   profile.company_id,
        prestation_id: prestation.id,
        date:         j.date,
        jour_semaine: j.jour_semaine,
        chauffeur_id: j.chauffeur_id || null,
        tarif_ht:     j.tarif_ht,
        statut:       'en_attente',
      }))
    )
  }

  // Recalcule le montant du dossier
  await supabase.rpc('recalc_dossier', { p_dossier_id: dossier_id })

  return NextResponse.json({ data: prestation }, { status: 201 })
}
