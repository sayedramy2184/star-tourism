import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeRapport } from '@/lib/rapportsData'

export const dynamic = 'force-dynamic'

// GET /api/rapports?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'dispatcher')) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const now = new Date()
  const from = req.nextUrl.searchParams.get('from') || `${now.getFullYear()}-01-01`
  const to = req.nextUrl.searchParams.get('to') || now.toISOString().slice(0, 10)

  try {
    const data = await computeRapport(supabase, from, to)
    return NextResponse.json({ data })
  } catch (e: any) {
    console.error('RAPPORTS ERROR:', e)
    return NextResponse.json({ error: e.message ?? 'Erreur' }, { status: 500 })
  }
}
