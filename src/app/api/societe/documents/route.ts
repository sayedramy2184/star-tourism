import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'societe-docs'
const COLUMN: Record<string, string> = {
  attestation: 'attestation_assurance_path',
  licence: 'licence_evtc_path',
  signature: 'signature_path',
  logo: 'logo_path',
}
const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp']

function kindFromPath(path: string): 'pdf' | 'image' {
  return path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
}

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
  if (!data) await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {})
}

// ── GET — URLs signées des documents (aperçu admin) ──
export async function GET() {
  const auth = await authorizeAdmin()
  if (auth.error) return auth.error
  const admin = createAdminClient()

  const { data: societe } = await admin
    .from('societe_parametres')
    .select('attestation_assurance_path, licence_evtc_path, signature_path, logo_path')
    .eq('company_id', auth.companyId)
    .maybeSingle()

  const paths: Record<string, string | null> = {
    attestation: societe?.attestation_assurance_path ?? null,
    licence: societe?.licence_evtc_path ?? null,
    signature: societe?.signature_path ?? null,
    logo: societe?.logo_path ?? null,
  }

  const out: Record<string, { url: string; kind: 'pdf' | 'image'; name: string } | null> = {
    attestation: null, licence: null, signature: null, logo: null,
  }
  for (const [key, path] of Object.entries(paths)) {
    if (!path) continue
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (signed?.signedUrl) {
      out[key] = { url: signed.signedUrl, kind: kindFromPath(path), name: path.split('/').pop() ?? path }
    }
  }
  return NextResponse.json({ data: out })
}

// ── POST — upload d'un document ──
export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin()
  if (auth.error) return auth.error
  const admin = createAdminClient()

  const form = await req.formData()
  const type = String(form.get('type') ?? '')
  const file = form.get('file') as File | null

  if (!COLUMN[type]) return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Format non supporté (PDF, PNG, JPG, WEBP)' }, { status: 400 })
  }
  if (type === 'logo' && ext === 'pdf') {
    return NextResponse.json({ error: 'Le logo doit être une image (PNG, JPG, WEBP)' }, { status: 400 })
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 15 Mo)' }, { status: 400 })
  }

  await ensureBucket(admin)

  // Chemin unique (évite le cache d'URL signée sur remplacement)
  const stamp = Math.random().toString(36).slice(2, 8)
  const path = `${auth.companyId}/${type}-${stamp}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || undefined,
    upsert: true,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Ancien fichier à supprimer après mise à jour
  const { data: societe } = await admin
    .from('societe_parametres').select(COLUMN[type]).eq('company_id', auth.companyId).maybeSingle()
  const oldPath = (societe as any)?.[COLUMN[type]] as string | null

  // Upsert du chemin (créé la ligne société si absente)
  const { error: updErr } = await admin
    .from('societe_parametres')
    .upsert({ company_id: auth.companyId, [COLUMN[type]]: path }, { onConflict: 'company_id' })
  if (updErr) {
    await admin.storage.from(BUCKET).remove([path]) // rollback
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (oldPath && oldPath !== path) {
    await admin.storage.from(BUCKET).remove([oldPath]).catch(() => {})
  }

  const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)
  return NextResponse.json({
    data: { url: signed?.signedUrl, kind: kindFromPath(path), name: `${type}.${ext}` },
  })
}

// ── DELETE — suppression d'un document ──
export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdmin()
  if (auth.error) return auth.error
  const admin = createAdminClient()

  const type = req.nextUrl.searchParams.get('type') ?? ''
  if (!COLUMN[type]) return NextResponse.json({ error: 'Type invalide' }, { status: 400 })

  const { data: societe } = await admin
    .from('societe_parametres').select(COLUMN[type]).eq('company_id', auth.companyId).maybeSingle()
  const path = (societe as any)?.[COLUMN[type]] as string | null
  if (path) await admin.storage.from(BUCKET).remove([path]).catch(() => {})

  await admin.from('societe_parametres')
    .update({ [COLUMN[type]]: null }).eq('company_id', auth.companyId)

  return NextResponse.json({ success: true })
}
