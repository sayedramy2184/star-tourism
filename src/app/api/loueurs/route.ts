import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/loueurs — liste simple (pour les sélecteurs)
export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('loueurs')
    .select('id, nom, contact_nom, telephone, email')
    .order('nom')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/loueurs — créer un loueur
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  if (!body.nom?.trim()) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const { data, error } = await supabase
    .from('loueurs')
    .insert({
      company_id:  profile.company_id,
      nom:         body.nom.trim(),
      contact_nom: body.contact_nom || null,
      telephone:   body.telephone || null,
      email:       body.email || null,
      notes:       body.notes || null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
