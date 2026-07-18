import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function genPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz'
  const bytes = randomBytes(12)
  let s = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) s += '-'
    s += alphabet[bytes[i] % alphabet.length]
  }
  return s
}

// Autorise admin/dispatcher et renvoie la fiche client (type = agence).
async function authorize(clientId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profil introuvable' }, { status: 403 }) }
  if (profile.role !== 'admin' && profile.role !== 'dispatcher') {
    return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  }

  const { data: cl } = await supabase
    .from('clients')
    .select('id, nom, contact_nom, email, telephone, type, profile_id, company_id')
    .eq('id', clientId)
    .single()
  if (!cl) return { error: NextResponse.json({ error: 'Client introuvable' }, { status: 404 }) }
  if (cl.type !== 'agence') {
    return { error: NextResponse.json({ error: 'Seules les agences peuvent avoir un accès portail' }, { status: 400 }) }
  }
  if (cl.company_id !== profile.company_id) {
    return { error: NextResponse.json({ error: 'Client hors de votre société' }, { status: 403 }) }
  }
  return { cl }
}

async function findAuthUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const users = (data?.users ?? []) as Array<{ id: string; email?: string | null }>
    if (error || users.length === 0) break
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit
    if (users.length < 200) break
  }
  return null
}

async function ensureProfileAndLink(
  admin: ReturnType<typeof createAdminClient>,
  cl: { id: string; nom: string; contact_nom: string | null; telephone: string | null; company_id: string },
  userId: string,
  email: string,
) {
  const { data: prof } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!prof) {
    const { error: pErr } = await admin.from('profiles').insert({
      id: userId,
      company_id: cl.company_id,
      role: 'agence',
      nom: cl.contact_nom || cl.nom,
      prenom: '',
      email,
      telephone: cl.telephone,
      actif: true,
    })
    if (pErr) return pErr
  }
  const { error: lErr } = await admin.from('clients').update({ profile_id: userId }).eq('id', cl.id)
  return lErr ?? null
}

// ── POST — créer (ou récupérer) l'accès agence ──
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id)
  if (auth.error) return auth.error
  const { cl } = auth
  const admin = createAdminClient()

  const body = await req.json().catch(() => ({}))
  const email = (body.email || cl.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  const password = (body.password && String(body.password).length >= 8) ? String(body.password) : genPassword()

  if (cl.profile_id) {
    const { data: linked } = await admin.auth.admin.getUserById(cl.profile_id)
    if (linked?.user) {
      return NextResponse.json(
        { error: 'Cet accès existe déjà. Utilisez « Réinitialiser le mot de passe ».' },
        { status: 409 },
      )
    }
    await admin.from('clients').update({ profile_id: null }).eq('id', cl.id)
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { agence: cl.nom, role: 'agence' },
  })

  if (cErr || !created?.user) {
    const already = /already.*(registered|been registered|exists)|email.*exists|duplicate/i.test(cErr?.message ?? '')
    if (!already) return NextResponse.json({ error: cErr?.message ?? 'Création impossible' }, { status: 500 })

    const existing = await findAuthUserByEmail(admin, email)
    if (!existing) {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email mais reste introuvable. Utilisez un autre email." }, { status: 409 })
    }
    const { data: otherCl } = await admin.from('clients').select('id, nom').eq('profile_id', existing.id).maybeSingle()
    if (otherCl && otherCl.id !== cl.id) {
      return NextResponse.json({ error: `Cet email est déjà lié à l'agence ${otherCl.nom}.` }, { status: 409 })
    }
    const { data: existingProfile } = await admin.from('profiles').select('id, role, company_id').eq('id', existing.id).maybeSingle()
    if (existingProfile && (existingProfile.role !== 'agence' || existingProfile.company_id !== cl.company_id)) {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un compte existant (autre rôle ou société).' }, { status: 409 })
    }
    const { error: pwErr } = await admin.auth.admin.updateUserById(existing.id, { password })
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })
    const linkErr = await ensureProfileAndLink(admin, cl, existing.id, email)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    return NextResponse.json({ data: { email, password }, recovered: true })
  }

  const userId = created.user.id
  const linkErr = await ensureProfileAndLink(admin, cl, userId, email)
  if (linkErr) {
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }
  return NextResponse.json({ data: { email, password } })
}

// ── PATCH — réinitialiser le mot de passe ──
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id)
  if (auth.error) return auth.error
  const { cl } = auth
  if (!cl.profile_id) return NextResponse.json({ error: 'Aucun accès à réinitialiser' }, { status: 400 })

  const password = genPassword()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(cl.profile_id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: { email: cl.email, password } })
}

// ── DELETE — révoquer l'accès ──
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id)
  if (auth.error) return auth.error
  const { cl } = auth
  if (!cl.profile_id) return NextResponse.json({ error: 'Aucun accès à révoquer' }, { status: 400 })

  const admin = createAdminClient()
  await admin.from('clients').update({ profile_id: null }).eq('id', cl.id)
  const { error } = await admin.auth.admin.deleteUser(cl.profile_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
