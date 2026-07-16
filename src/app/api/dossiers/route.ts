import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Validation schemas ────────────────────────

const JourSchema = z.object({
  date:           z.string(),
  jour_semaine:   z.string(),
  chauffeur_id:   z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v || null),
  tarif_ht:       z.number(),
  note:           z.string().optional(),
})

const PrestationSchema = z.object({
  ordre:                  z.number(),
  type:                   z.enum(['mad','transfert']),
  date_debut:             z.string(),
  date_fin:               z.string(),
  heure_depart:           z.string().nullable().optional(),
  adresse_depart:         z.string().nullable().optional(),
  adresse_arrivee:        z.string().nullable().optional(),
  vol_numero:             z.string().nullable().optional(),
  vol_heure:              z.string().nullable().optional(),
  vol_ville:              z.string().nullable().optional(),
  vol_terminal:           z.string().nullable().optional(),
  vol_arrivee:            z.boolean().nullable().optional(),
  nb_passagers:           z.number().nullable().optional(),
  nb_bagages:             z.number().nullable().optional(),
  heure_debut_journee:    z.string().nullable().optional(),
  heure_fin_journee:      z.string().nullable().optional(),
  tarif_journalier_ht:    z.number().nullable().optional(),
  tarif_fixe_ht:          z.number().nullable().optional(),
  modele_souhaite:        z.string().nullable().optional(),
  vehicule_id:            z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v || null),
  vehicule_ext_id:        z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v || null),
  // Véhicule externe saisi à la volée (loueur) — sera créé dans vehicules_ext
  ext_marque:             z.string().nullable().optional(),
  ext_modele:             z.string().nullable().optional(),
  ext_immatriculation:    z.string().nullable().optional(),
  ext_loueur:             z.string().nullable().optional(),
  ext_cout_ht:            z.number().nullable().optional(),
  affectation_differee:   z.boolean().default(false),
  chauffeur_id:           z.union([z.string().uuid(), z.literal(''), z.null()]).optional().transform(v => v || null),
  notes:                  z.string().nullable().optional(),
  jours:                  z.array(JourSchema).optional(),
})

const PassagerSchema = z.object({
  nom:          z.string().min(1),
  nationalite:  z.string().nullable().optional(),
  telephone:    z.string().nullable().optional(),
  nb_bagages:   z.number().nullable().optional(),
  notes:        z.string().nullable().optional(),
})

const DossierSchema = z.object({
  client_id:    z.string().uuid(),
  date_debut:   z.string(),
  date_fin:     z.string(),
  statut:       z.enum(['en_attente','en_cours','termine']).default('en_attente'),
  notes:        z.string().nullable().optional(),
  prestations:  z.array(PrestationSchema).min(1),
  passagers:    z.array(PassagerSchema).optional(),
})

// ── GET /api/dossiers ─────────────────────────

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const statut     = searchParams.get('statut')
  const client_id  = searchParams.get('client_id')
  const search     = searchParams.get('search')

  let query = supabase
    .from('dossiers')
    .select(`
      *,
      client:clients(id, nom, contact_nom, type),
      prestations(id, type, statut, date_debut, date_fin, montant_ht)
    `)
    .order('created_at', { ascending: false })

  if (statut)    query = query.eq('statut', statut)
  if (client_id) query = query.eq('client_id', client_id)
  if (search)    query = query.ilike('numero', `%${search}%`)

  const { data, error } = await query.limit(100)

  if (error) { console.error('API ERROR:', error); return NextResponse.json({ error: error.message }, { status: 500 }) }
  return NextResponse.json({ data })
}

// ── POST /api/dossiers ────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createClient()

  // Vérifie l'auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Récupère le profil pour company_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const company_id = profile.company_id

  // Validation
  const body = await req.json()
  const parsed = DossierSchema.safeParse(body)
  if (!parsed.success) {
    console.error('ZOD ERROR:', JSON.stringify(parsed.error.flatten()))
    console.error('BODY RECEIVED:', JSON.stringify(body))
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { prestations, passagers, ...dossierData } = parsed.data

  // Génère le numéro de dossier
  const { data: numData } = await supabase
    .rpc('next_dossier_numero', { p_company_id: company_id })
  const numero = numData as string

  // Calcule le montant total HT
  let montant_ht = 0
  for (const p of prestations) {
    if (p.type === 'mad' && p.jours) {
      montant_ht += p.jours.reduce((s, j) => s + j.tarif_ht, 0)
    } else if (p.type === 'transfert' && p.tarif_fixe_ht) {
      montant_ht += p.tarif_fixe_ht
    }
  }

  const montant_tva = Math.round(montant_ht * 0.10 * 100) / 100
  const montant_ttc = montant_ht + montant_tva

  // ── Crée le dossier ──
  const { data: dossier, error: dossierError } = await supabase
    .from('dossiers')
    .insert({
      company_id,
      numero,
      ...dossierData,
      montant_ht,
      montant_tva,
      montant_ttc,
      created_by: user.id,
    })
    .select()
    .single()

  if (dossierError) {
    console.error('DOSSIER INSERT ERROR:', JSON.stringify(dossierError))
    return NextResponse.json({ error: dossierError.message }, { status: 500 })
  }

  // ── Crée les passagers du dossier ──
  if (passagers && passagers.length > 0) {
    const passagersToInsert = passagers
      .filter(p => p.nom.trim())
      .map(p => ({
        company_id,
        dossier_id:  dossier.id,
        nom:         p.nom.trim(),
        nationalite: p.nationalite || null,
        telephone:   p.telephone || null,
        nb_bagages:  p.nb_bagages ?? 0,
        notes:       p.notes || null,
      }))
    if (passagersToInsert.length > 0) {
      const { error: passagersError } = await supabase
        .from('passagers')
        .insert(passagersToInsert)
      if (passagersError) console.error('Erreur passagers:', passagersError)
    }
  }

  // ── Crée les prestations ──
  for (const presta of prestations) {
    const { jours, ext_marque, ext_modele, ext_immatriculation, ext_loueur, ext_cout_ht, ...prestationData } = presta

    // Calcule montant_ht de la prestation
    let presta_ht = 0
    if (presta.type === 'mad' && jours) {
      presta_ht = jours.reduce((s, j) => s + j.tarif_ht, 0)
    } else if (presta.type === 'transfert' && presta.tarif_fixe_ht) {
      presta_ht = presta.tarif_fixe_ht
    }

    // Véhicule externe saisi à la volée → crée l'entrée vehicules_ext
    let vehiculeExtId = prestationData.vehicule_ext_id || null
    if (!vehiculeExtId && (ext_marque || ext_immatriculation)) {
      const { data: extCreated } = await supabase
        .from('vehicules_ext')
        .insert({
          company_id,
          marque: ext_marque || '—',
          modele: ext_modele || '',
          immatriculation: ext_immatriculation || null,
          loueur: ext_loueur || null,
          cout_ht: ext_cout_ht ?? null,
        })
        .select('id')
        .single()
      vehiculeExtId = extCreated?.id ?? null
    }

    const { data: prestationCreated, error: prestationError } = await supabase
      .from('prestations')
      .insert({
        company_id,
        dossier_id: dossier.id,
        ...prestationData,
        vehicule_id:     prestationData.vehicule_id || null,
        vehicule_ext_id: vehiculeExtId,
        chauffeur_id:    prestationData.chauffeur_id || null,
        montant_ht:      presta_ht,
      })
      .select()
      .single()

    if (prestationError) {
      console.error('Erreur prestation:', prestationError)
      continue
    }

    // ── Crée les jours MAD ──
    if (presta.type === 'mad' && jours && jours.length > 0) {
      const joursToInsert = jours.map(j => ({
        company_id,
        prestation_id:   prestationCreated.id,
        date:            j.date,
        jour_semaine:    j.jour_semaine,
        chauffeur_id:    j.chauffeur_id || null,
        tarif_ht:        j.tarif_ht,
        note:            j.note || null,
        statut:          'en_attente',
      }))

      const { error: joursError } = await supabase
        .from('jours_mad')
        .insert(joursToInsert)

      if (joursError) console.error('Erreur jours MAD:', joursError)
    }
  }

  return NextResponse.json({ data: dossier }, { status: 201 })
}
