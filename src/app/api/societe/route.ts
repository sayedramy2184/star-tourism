import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const { data, error } = await supabase
    .from('societe_parametres')
    .select('*')
    .eq('company_id', profile.company_id)
    .single()

  if (error || !data) {
    // Crée les paramètres par défaut si inexistants
    const { data: created } = await supabase
      .from('societe_parametres')
      .insert({ company_id: profile.company_id, nom: 'Ma société', taux_tva: 10 })
      .select().single()
    return NextResponse.json({ data: created })
  }

  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()

  const { data, error } = await supabase
    .from('societe_parametres')
    .upsert({
      ...body,
      company_id: profile.company_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
