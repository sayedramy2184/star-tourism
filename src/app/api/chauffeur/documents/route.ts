import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'societe-docs'
function kindFromPath(path: string): 'pdf' | 'image' {
  return path.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
}

// GET — documents officiels + infos société pour le chauffeur connecté
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: chauffeur } = await supabase
    .from('chauffeurs').select('id, company_id').eq('profile_id', user.id).maybeSingle()
  if (!chauffeur) return NextResponse.json({ error: 'Aucune fiche chauffeur liée' }, { status: 404 })

  // Restriction : documents accessibles UNIQUEMENT s'il a une mission aujourd'hui.
  const today = new Date().toISOString().slice(0, 10)
  const [{ count: nbJours }, { count: nbTransferts }] = await Promise.all([
    supabase.from('jours_mad').select('id', { count: 'exact', head: true })
      .eq('chauffeur_id', chauffeur.id).eq('date', today),
    supabase.from('prestations').select('id', { count: 'exact', head: true })
      .eq('chauffeur_id', chauffeur.id).eq('type', 'transfert').eq('date_debut', today),
  ])
  if ((nbJours ?? 0) + (nbTransferts ?? 0) === 0) {
    return NextResponse.json(
      { error: 'Documents accessibles uniquement les jours où vous avez une mission.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()
  const { data: s } = await admin
    .from('societe_parametres')
    .select('nom, gerant_nom, adresse, code_postal, ville, siret, numero_tva, telephone, email, attestation_assurance_path, licence_evtc_path, signature_path')
    .eq('company_id', chauffeur.company_id)
    .maybeSingle()

  async function signed(path: string | null | undefined) {
    if (!path) return null
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600)
    return data?.signedUrl ? { url: data.signedUrl, kind: kindFromPath(path) } : null
  }

  return NextResponse.json({
    data: {
      societe: {
        nom: s?.nom ?? null,
        gerant_nom: s?.gerant_nom ?? null,
        adresse: s?.adresse ?? null,
        code_postal: s?.code_postal ?? null,
        ville: s?.ville ?? null,
        siret: s?.siret ?? null,
        numero_tva: s?.numero_tva ?? null,
        telephone: s?.telephone ?? null,
        email: s?.email ?? null,
      },
      signature: await signed(s?.signature_path),
      attestation: await signed(s?.attestation_assurance_path),
      licence: await signed(s?.licence_evtc_path),
    },
  })
}
