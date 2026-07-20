import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAppAccount } from '@/lib/appAccount'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// POST — l'agence DEMANDE l'annulation d'un service (à confirmer par le dispatch)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const account = await getAppAccount(supabase, user.id)
  if (!account || account.type !== 'agence') return NextResponse.json({ error: 'Réservé aux agences' }, { status: 403 })

  const admin = createAdminClient()
  const { data: prest } = await admin
    .from('prestations')
    .select('id, statut, dossier:dossiers(client_id, statut)')
    .eq('id', params.id).single()
  if (!prest) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const dossier = Array.isArray(prest.dossier) ? prest.dossier[0] : prest.dossier
  if (!dossier || dossier.client_id !== account.id) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (prest.statut === 'annule' || prest.statut === 'termine') {
    return NextResponse.json({ error: 'This service can no longer be cancelled.' }, { status: 409 })
  }

  const { error } = await admin.from('prestations').update({ annulation_demandee: true }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { ok: true } })
}
