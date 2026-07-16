import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function one(v: any) { return Array.isArray(v) ? v[0] : v }
function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}
function daysUntil(dateStr: string, today: string) {
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 864e5)
}

type Sev = 'danger' | 'warn'
interface Alerte { severity: Sev; title: string; detail: string; href: string }

// Alerte document : expiré (danger) ou < 30 j (warn) ; sinon null
function docAlerte(dateStr: string | null, today: string): { sev: Sev; label: string } | null {
  if (!dateStr) return null
  const d = daysUntil(dateStr, today)
  if (d < 0) return { sev: 'danger', label: `expiré depuis ${-d} j` }
  if (d <= 30) return { sev: 'warn', label: `expire dans ${d} j` }
  return null
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)
  const horizonAffect = addDays(today, 2)   // missions non affectées : J → J+2
  const horizonConflit = addDays(today, 14) // conflits : 2 semaines

  const [chRes, vhRes, joursRes, transRes] = await Promise.all([
    supabase.from('chauffeurs').select('id, nom, prenom, vtc_card_expiry, permis_expiry, visite_medicale_expiry, carte_sejour_expiry, carte_qualif_expiry'),
    supabase.from('vehicules').select('id, marque, modele, immatriculation, ct_date, assurance_date'),
    supabase.from('jours_mad')
      .select(`date, chauffeur_id, vehicule_id, sous_traitant_id,
        chauffeur:chauffeurs(nom, prenom),
        prestation:prestations(statut, dossier:dossiers(id, numero, client:clients(nom)))`)
      .gte('date', today).lte('date', horizonConflit),
    supabase.from('prestations')
      .select(`id, date_debut, heure_depart, chauffeur_id, vehicule_id, sous_traitant_id, statut,
        dossier:dossiers(id, numero, client:clients(nom))`)
      .eq('type', 'transfert').gte('date_debut', today).lte('date_debut', horizonConflit),
  ])

  const documents: Alerte[] = []
  const nonAffectees: Alerte[] = []
  const conflits: Alerte[] = []

  // ── Documents chauffeurs ──
  for (const c of (chRes.data ?? [])) {
    const nom = `${c.prenom} ${c.nom}`
    const vtc = docAlerte(c.vtc_card_expiry, today)
    if (vtc) documents.push({ severity: vtc.sev, title: `Carte VTC — ${nom}`, detail: vtc.label, href: `/dashboard/chauffeurs/${c.id}` })
    const permis = docAlerte(c.permis_expiry, today)
    if (permis) documents.push({ severity: permis.sev, title: `Permis — ${nom}`, detail: permis.label, href: `/dashboard/chauffeurs/${c.id}` })
    const vm = docAlerte((c as any).visite_medicale_expiry, today)
    if (vm) documents.push({ severity: vm.sev, title: `Visite médicale — ${nom}`, detail: vm.label, href: `/dashboard/chauffeurs/${c.id}` })
    const sej = docAlerte((c as any).carte_sejour_expiry, today)
    if (sej) documents.push({ severity: sej.sev, title: `Carte de séjour — ${nom}`, detail: sej.label, href: `/dashboard/chauffeurs/${c.id}` })
    const qual = docAlerte((c as any).carte_qualif_expiry, today)
    if (qual) documents.push({ severity: qual.sev, title: `Carte qualification — ${nom}`, detail: qual.label, href: `/dashboard/chauffeurs/${c.id}` })
  }
  // ── Documents véhicules ──
  for (const v of (vhRes.data ?? [])) {
    const veh = `${v.marque} ${v.modele} (${v.immatriculation})`
    const ct = docAlerte(v.ct_date, today)
    if (ct) documents.push({ severity: ct.sev, title: `Contrôle technique — ${veh}`, detail: ct.label, href: `/dashboard/vehicules/${v.id}` })
    const ass = docAlerte(v.assurance_date, today)
    if (ass) documents.push({ severity: ass.sev, title: `Assurance — ${veh}`, detail: ass.label, href: `/dashboard/vehicules/${v.id}` })
  }

  // ── Missions imminentes non affectées + conflits ──
  // On unifie jours MAD et transferts en « occurrences » {date, chauffeur_id, vehicule_id, ...}
  const occ: { date: string; chauffeur_id: string | null; vehicule_id: string | null; sous_traitant_id: string | null; statut: string; dossierId: string; numero: string; client: string; chauffeurNom: string | null; kind: string }[] = []

  for (const j of (joursRes.data ?? [])) {
    const p = one((j as any).prestation); const d = one(p?.dossier); const cl = one(d?.client); const ch = one((j as any).chauffeur)
    occ.push({
      date: (j as any).date, chauffeur_id: (j as any).chauffeur_id, vehicule_id: (j as any).vehicule_id,
      sous_traitant_id: (j as any).sous_traitant_id, statut: p?.statut ?? 'en_attente',
      dossierId: d?.id, numero: d?.numero, client: cl?.nom ?? '', chauffeurNom: ch ? `${ch.prenom} ${ch.nom}` : null, kind: 'MAD',
    })
  }
  for (const t of (transRes.data ?? [])) {
    const d = one((t as any).dossier); const cl = one(d?.client)
    occ.push({
      date: (t as any).date_debut, chauffeur_id: (t as any).chauffeur_id, vehicule_id: (t as any).vehicule_id,
      sous_traitant_id: (t as any).sous_traitant_id, statut: (t as any).statut ?? 'en_attente',
      dossierId: d?.id, numero: d?.numero, client: cl?.nom ?? '', chauffeurNom: null, kind: 'Transfert',
    })
  }

  // Non affectées (J → J+2, hors annulé/terminé, ni chauffeur ni sous-traitant)
  for (const o of occ) {
    if (o.date > horizonAffect) continue
    if (o.statut === 'annule' || o.statut === 'termine') continue
    if (!o.chauffeur_id && !o.sous_traitant_id) {
      const quand = o.date === today ? "aujourd'hui" : o.date === addDays(today, 1) ? 'demain' : o.date
      nonAffectees.push({
        severity: o.date === today ? 'danger' : 'warn',
        title: `${o.kind} sans chauffeur — ${o.client}`,
        detail: `${o.numero} · ${quand}`,
        href: `/dashboard/dossiers/${o.dossierId}`,
      })
    }
  }

  // Conflits : même chauffeur (ou même véhicule) sur 2+ missions le même jour
  const seenConflit = new Set<string>()
  function detectConflit(key: 'chauffeur_id' | 'vehicule_id', labelFn: (o: any) => string) {
    const map = new Map<string, any[]>()
    for (const o of occ) {
      const id = (o as any)[key]
      if (!id || o.statut === 'annule') continue
      const k = `${id}|${o.date}`
      const arr = map.get(k) ?? []; arr.push(o); map.set(k, arr)
    }
    for (const [k, arr] of Array.from(map.entries())) {
      if (arr.length < 2) continue
      if (seenConflit.has(k)) continue
      seenConflit.add(k)
      const o = arr[0]
      const quand = o.date === today ? "aujourd'hui" : o.date === addDays(today, 1) ? 'demain' : o.date
      conflits.push({
        severity: 'danger',
        title: `Conflit — ${labelFn(o)}`,
        detail: `${arr.length} missions le ${quand} (${arr.map((x: any) => x.numero).join(', ')})`,
        href: `/dashboard/planning`,
      })
    }
  }
  detectConflit('chauffeur_id', (o) => o.chauffeurNom ?? 'chauffeur')
  detectConflit('vehicule_id', () => 'véhicule')

  const all = [...documents, ...nonAffectees, ...conflits]
  return NextResponse.json({
    data: {
      total: all.length,
      danger: all.filter(a => a.severity === 'danger').length,
      warn: all.filter(a => a.severity === 'warn').length,
      groups: { documents, nonAffectees, conflits },
    },
  })
}
