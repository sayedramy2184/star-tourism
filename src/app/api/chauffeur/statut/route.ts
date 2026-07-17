import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Statuts qu'un chauffeur / sous-traitant peut poser depuis le terrain
const ALLOWED = ['confirme', 'en_cours', 'termine'] as const

// POST /api/chauffeur/statut — { prestation_id, statut }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const account = await getAppAccount(supabase, user.id)
  if (!account) return NextResponse.json({ error: 'Aucun compte lié' }, { status: 404 })

  const { prestation_id, statut } = await req.json()
  if (!prestation_id) return NextResponse.json({ error: 'prestation_id requis' }, { status: 400 })
  if (!ALLOWED.includes(statut)) return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })

  const col = account.type === 'chauffeur' ? 'chauffeur_id' : 'sous_traitant_id'

  // La prestation est-elle affectée au compte, directement ou via un jour MAD ?
  const { data: prest } = await supabase
    .from('prestations')
    .select('id, chauffeur_id, sous_traitant_id')
    .eq('id', prestation_id)
    .single()

  let owns = !!prest && (prest as any)[col] === account.id
  if (!owns) {
    const { data: jour } = await supabase
      .from('jours_mad')
      .select('id')
      .eq('prestation_id', prestation_id)
      .eq(col, account.id)
      .limit(1)
      .maybeSingle()
    owns = !!jour
  }
  if (!owns) return NextResponse.json({ error: 'Mission non autorisée' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin.from('prestations').update({ statut }).eq('id', prestation_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { statut } })
}
