import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { photoChauffeurUrl } from '@/lib/photoChauffeur'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'chauffeur-photos'
const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp']

async function authorizeAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const { data: profile } = await supabase
    .from('profiles').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: NextResponse.json({ error: 'Profil introuvable' }, { status: 403 }) }
  if (profile.role !== 'admin' && profile.role !== 'dispatcher') {
    return { error: NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 }) }
  }
  return { companyId: profile.company_id as string }
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin.storage.getBucket(BUCKET)
  if (!data) await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {})
}

// ── POST — upload de la photo du chauffeur ──
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeAdmin()
  if (auth.error) return auth.error
  const admin = createAdminClient()

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Format non supporté (PNG, JPG, WEBP)' }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 15 Mo)' }, { status: 400 })
  }

  await ensureBucket(admin)

  const stamp = Math.random().toString(36).slice(2, 8)
  const path = `${auth.companyId}/${params.id}-${stamp}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || undefined, upsert: true,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Ancienne photo à supprimer après mise à jour
  const { data: ch } = await admin.from('chauffeurs').select('photo_path').eq('id', params.id).single()
  const oldPath = ch?.photo_path as string | null

  const { error: updErr } = await admin.from('chauffeurs').update({ photo_path: path }).eq('id', params.id)
  if (updErr) {
    await admin.storage.from(BUCKET).remove([path]) // rollback
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (oldPath && oldPath !== path) {
    await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {})
  }

  return NextResponse.json({ data: { path, url: photoChauffeurUrl(path) } })
}

// ── DELETE — suppression de la photo ──
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeAdmin()
  if (auth.error) return auth.error
  const admin = createAdminClient()

  const { data: ch } = await admin.from('chauffeurs').select('photo_path').eq('id', params.id).single()
  const path = ch?.photo_path as string | null
  if (path) await admin.storage.from(BUCKET).remove([path]).catch(() => {})

  await admin.from('chauffeurs').update({ photo_path: null }).eq('id', params.id)
  return NextResponse.json({ success: true })
}
