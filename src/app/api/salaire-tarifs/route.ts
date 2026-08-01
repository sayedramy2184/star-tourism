import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ── POST /api/salaire-tarifs — définir/modifier les tarifs de paie d'un dossier ──
// Upsert sur (chauffeur_id, dossier_id). tarif null => retour au tarif par défaut.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  if (!body.chauffeur_id || !body.dossier_id)
    return NextResponse.json({ error: 'chauffeur_id et dossier_id requis' }, { status: 400 })

  const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v))
  const tarif_jour = num(body.tarif_jour)
  const tarif_transfert = num(body.tarif_transfert)
  if ((tarif_jour != null && tarif_jour < 0) || (tarif_transfert != null && tarif_transfert < 0))
    return NextResponse.json({ error: 'Tarif invalide' }, { status: 400 })

  const { data, error } = await supabase
    .from('salaire_chauffeur_dossier')
    .upsert({
      company_id:   profile.company_id,
      chauffeur_id: body.chauffeur_id,
      dossier_id:   body.dossier_id,
      tarif_jour,
      tarif_transfert,
      note:         body.note || null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'chauffeur_id,dossier_id' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
