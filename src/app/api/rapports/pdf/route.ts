import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { computeRapport } from '@/lib/rapportsData'
import { renderRapportBuffer } from '@/components/rapports/RapportPDF'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'dispatcher')) {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  const now = new Date()
  const from = req.nextUrl.searchParams.get('from') || `${now.getFullYear()}-01-01`
  const to = req.nextUrl.searchParams.get('to') || now.toISOString().slice(0, 10)

  const [rapport, { data: societe }] = await Promise.all([
    computeRapport(supabase, from, to),
    supabase.from('societe_parametres')
      .select('nom, adresse, code_postal, ville, telephone, email, mentions_legales')
      .eq('company_id', profile.company_id).maybeSingle(),
  ])

  const buffer = await renderRapportBuffer({
    rapport,
    societe: societe ?? { nom: null, adresse: null, code_postal: null, ville: null, telephone: null, email: null, mentions_legales: null },
    dateEdition: now.toISOString().slice(0, 10),
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Rapport-${from}_${to}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
