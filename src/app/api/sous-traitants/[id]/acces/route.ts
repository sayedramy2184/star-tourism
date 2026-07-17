import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Mot de passe lisible : 3 groupes de 4 caractères sans ambiguïté.
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

// Vérifie que l'appelant est admin/dispatcher et renvoie la fiche sous-traitant.
async function authorize(stId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profil introuvable' }, { status: 403 }) }
  if (profile.role !== 'admin' && profile.role !== 'dispatcher') {
    return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  }

  const { data: st } = await supabase
    .from('sous_traitants')
    .select('id, societe, contact_nom, email, telephone, profile_id, company_id')
    .eq('id', stId)
    .single()
  if (!st) return { error: NextResponse.json({ error: 'Sous-traitant introuvable' }, { status: 404 }) }
  if (st.company_id !== profile.company_id) {
    return { error: NextResponse.json({ error: 'Sous-traitant hors de votre société' }, { status: 403 }) }
  }

  return { st }
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

// Garantit la présence du profil (rôle sous_traitant) puis lie la fiche au compte.
async function ensureProfileAndLink(
  admin: ReturnType<typeof createAdminClient>,
  st: { id: string; societe: string; contact_nom: string | null; telephone: string | null; company_id: string },
  userId: string,
  email: string,
) {
  const { data: prof } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!prof) {
    const { error: pErr } = await admin.from('profiles').insert({
      id: userId,
      company_id: st.company_id,
      role: 'sous_traitant',
      nom: st.contact_nom || st.societe,
      prenom: '',
      email,
      telephone: st.telephone,
      actif: true,
    })
    if (pErr) return pErr
  }
  const { error: lErr } = await admin.from('sous_traitants').update({ profile_id: userId }).eq('id', st.id)
  return lErr ?? null
}

// ── POST — créer (ou récupérer) l'accès sous-traitant ────────────
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id)
  if (auth.error) return auth.error
  const { st } = auth
  const admin = createAdminClient()

  const body = await req.json().catch(() => ({}))
  const email = (body.email || st.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  const password = (body.password && String(body.password).length >= 8) ? String(body.password) : genPassword()

  // — Cas 1 : un lien existe déjà —
  if (st.profile_id) {
    const { data: linked } = await admin.auth.admin.getUserById(st.profile_id)
    if (linked?.user) {
      return NextResponse.json(
        { error: 'Cet accès existe déjà. Utilisez « Réinitialiser le mot de passe » pour le modifier.' },
        { status: 409 },
      )
    }
    await admin.from('sous_traitants').update({ profile_id: null }).eq('id', st.id)
  }

  // — Création du compte Auth —
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { societe: st.societe, role: 'sous_traitant' },
  })

  // — Cas 2 : email déjà enregistré — récupération sûre —
  if (cErr || !created?.user) {
    const already = /already.*(registered|been registered|exists)|email.*exists|duplicate/i.test(cErr?.message ?? '')
    if (!already) {
      return NextResponse.json({ error: cErr?.message ?? 'Création impossible' }, { status: 500 })
    }

    const existing = await findAuthUserByEmail(admin, email)
    if (!existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email mais reste introuvable. Utilisez un autre email." },
        { status: 409 },
      )
    }

    const { data: otherSt } = await admin
      .from('sous_traitants').select('id, societe').eq('profile_id', existing.id).maybeSingle()
    if (otherSt && otherSt.id !== st.id) {
      return NextResponse.json(
        { error: `Cet email est déjà lié au sous-traitant ${otherSt.societe}.` },
        { status: 409 },
      )
    }
    const { data: existingProfile } = await admin
      .from('profiles').select('id, role, company_id').eq('id', existing.id).maybeSingle()
    if (existingProfile && (existingProfile.role !== 'sous_traitant' || existingProfile.company_id !== st.company_id)) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé par un compte existant (autre rôle ou société). Utilisez un autre email.' },
        { status: 409 },
      )
    }

    const { error: pwErr } = await admin.auth.admin.updateUserById(existing.id, { password })
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 })

    const linkErr = await ensureProfileAndLink(admin, st, existing.id, email)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })

    return NextResponse.json({ data: { email, password }, recovered: true })
  }

  // — Création normale —
  const userId = created.user.id
  const linkErr = await ensureProfileAndLink(admin, st, userId, email)
  if (linkErr) {
    await admin.auth.admin.deleteUser(userId) // rollback (cascade profiles)
    return NextResponse.json({ error: linkErr.message }, { status: 500 })
  }

  return NextResponse.json({ data: { email, password } })
}

// ── PATCH — réinitialiser le mot de passe ─────
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id)
  if (auth.error) return auth.error
  const { st } = auth

  if (!st.profile_id) {
    return NextResponse.json({ error: 'Aucun accès à réinitialiser' }, { status: 400 })
  }

  const password = genPassword()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(st.profile_id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { email: st.email, password } })
}

// ── DELETE — révoquer l'accès ─────────────────
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize(params.id)
  if (auth.error) return auth.error
  const { st } = auth

  if (!st.profile_id) {
    return NextResponse.json({ error: 'Aucun accès à révoquer' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin.from('sous_traitants').update({ profile_id: null }).eq('id', st.id)
  const { error } = await admin.auth.admin.deleteUser(st.profile_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
