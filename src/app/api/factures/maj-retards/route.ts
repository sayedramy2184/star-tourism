import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// POST — passe en « en_retard » les factures émises/envoyées dont l'échéance est dépassée.
// Scopé société par la RLS. Appelé à l'ouverture de la facturation (pas d'effet de bord sur un GET).
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('factures')
    .update({ statut: 'en_retard', updated_at: new Date().toISOString() })
    .lt('date_echeance', today)
    .in('statut', ['emise', 'envoyee'])
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { count: data?.length ?? 0 } })
}
