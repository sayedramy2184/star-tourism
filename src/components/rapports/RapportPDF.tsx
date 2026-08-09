// Server-only — PDF de synthèse d'un rapport d'activité.
import React from 'react'
import fs from 'fs'
import path from 'path'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { RapportData } from '@/lib/rapportsData'

let LOGO_DATA: string | null = null
for (const nom of ['logo-facture.png', 'logo.png']) {
  try { LOGO_DATA = `data:image/png;base64,${fs.readFileSync(path.join(process.cwd(), 'public', nom)).toString('base64')}`; break } catch {}
}

const OR = '#9a7a28', NOIR = '#16130e', GRIS = '#5a564e', LIGNE = '#d8d2c8', CREME = '#f5f2ed', VERT = '#1e5e3a', ROUGE = '#9e2a2a'

function eur(n: number) {
  const v = n ?? 0, neg = v < 0
  const [e, d] = Math.abs(v).toFixed(0).split('.')
  return `${neg ? '-' : ''}${e.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} EUR`
}
function safe(s: string | null | undefined) {
  return String(s ?? '').replace(/[  ]/g, ' ').replace(/[→➔]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[…]/g, '...')
}
function fmtDate(d: string) { const [y, m, j] = d.split('-'); return j ? `${j}/${m}/${y}` : d }

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontSize: 9, fontFamily: 'Helvetica', color: NOIR },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  logo: { width: 130, objectFit: 'contain' },
  societeNom: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  societeLine: { fontSize: 8.5, color: GRIS, marginTop: 2, textAlign: 'right' },
  titleRow: { borderBottomWidth: 2, borderBottomColor: NOIR, paddingBottom: 6, marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  period: { fontSize: 9, color: GRIS, marginTop: 2 },
  sectionTitle: { fontSize: 8, letterSpacing: 1.5, color: OR, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '31.5%', border: `1px solid ${LIGNE}`, padding: 8, marginBottom: 8 },
  kpiLabel: { fontSize: 7, color: GRIS, textTransform: 'uppercase', letterSpacing: 1 },
  kpiVal: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LIGNE },
  rowLabel: { fontSize: 9.5, color: GRIS }, rowVal: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  bandeau: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, marginTop: 4 },
  bandeauLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  bandeauVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff' },
  th: { flexDirection: 'row', backgroundColor: NOIR, paddingVertical: 4, paddingHorizontal: 6 },
  thc: { fontSize: 7.5, color: '#fff', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LIGNE },
  td: { fontSize: 9 },
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LIGNE, paddingTop: 6 },
  footerTxt: { fontSize: 7, color: GRIS, textAlign: 'center' },
})

export interface RapportPDFData {
  rapport: RapportData
  societe: { nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null; telephone: string | null; email: string | null; mentions_legales: string | null }
  dateEdition: string
}

function Doc({ rapport, societe, dateEdition }: RapportPDFData) {
  const r = rapport.rentabilite, f = rapport.financier, c = rapport.commercial
  const ville = [societe.code_postal, societe.ville].filter(Boolean).join(' ')
  return (
    <Document title={`Rapport ${rapport.periode.from} - ${rapport.periode.to}`} author={societe.nom ?? 'Star Tourism Services'}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>{LOGO_DATA ? <Image src={LOGO_DATA} style={s.logo} /> : <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>STAR TOURISME SERVICES</Text>}</View>
          <View>
            <Text style={s.societeNom}>{safe(societe.nom) || 'Ma societe'}</Text>
            {societe.adresse ? <Text style={s.societeLine}>{safe(societe.adresse)}</Text> : null}
            {ville ? <Text style={s.societeLine}>{safe(ville)}</Text> : null}
            {societe.telephone ? <Text style={s.societeLine}>{safe(societe.telephone)}</Text> : null}
          </View>
        </View>

        <View style={s.titleRow}>
          <Text style={s.title}>Rapport d'activite</Text>
          <Text style={s.period}>Periode du {fmtDate(rapport.periode.from)} au {fmtDate(rapport.periode.to)}  ·  Edite le {fmtDate(dateEdition)}</Text>
        </View>

        {/* Synthèse KPIs */}
        <Text style={s.sectionTitle}>Synthese</Text>
        <View style={s.kpiRow}>
          <Kpi label="CA HT" val={eur(f.caHt)} />
          <Kpi label="Facture TTC" val={eur(f.factureTtc)} />
          <Kpi label="Encaisse" val={eur(f.encaisse)} color={VERT} />
          <Kpi label="Impayes echus" val={eur(f.impayes)} color={ROUGE} />
          <Kpi label="TVA collectee" val={eur(f.tvaCollectee)} />
          <Kpi label="Marge nette" val={`${eur(r.margeNette)} (${r.tauxMarge}%)`} color={r.margeNette >= 0 ? VERT : ROUGE} />
        </View>

        {/* Rentabilité */}
        <Text style={s.sectionTitle}>Rentabilite</Text>
        <View style={s.row}><Text style={s.rowLabel}>Revenus HT</Text><Text style={[s.rowVal, { color: OR }]}>{eur(r.revenus)}</Text></View>
        <View style={s.row}><Text style={s.rowLabel}>Paie chauffeurs</Text><Text style={s.rowVal}>- {eur(r.coutChauffeurs)}</Text></View>
        <View style={s.row}><Text style={s.rowLabel}>Sous-traitance</Text><Text style={s.rowVal}>- {eur(r.coutSousTraitance)}</Text></View>
        <View style={s.row}><Text style={s.rowLabel}>Loyers vehicules</Text><Text style={s.rowVal}>- {eur(r.coutLoyers)}</Text></View>
        <View style={[s.bandeau, { backgroundColor: r.margeNette >= 0 ? VERT : ROUGE }]}>
          <Text style={s.bandeauLabel}>Marge nette ({r.tauxMarge} %)</Text>
          <Text style={s.bandeauVal}>{eur(r.margeNette)}</Text>
        </View>

        {/* Top clients */}
        <Text style={s.sectionTitle}>Top clients</Text>
        <View style={s.th}>
          <Text style={[s.thc, { width: '60%' }]}>Client</Text>
          <Text style={[s.thc, { width: '20%', textAlign: 'right' }]}>Dossiers</Text>
          <Text style={[s.thc, { width: '20%', textAlign: 'right' }]}>CA HT</Text>
        </View>
        {c.topClients.slice(0, 8).map((cl, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={[s.td, { width: '60%' }]}>{safe(cl.nom)}</Text>
            <Text style={[s.td, { width: '20%', textAlign: 'right' }]}>{cl.dossiers}</Text>
            <Text style={[s.td, { width: '20%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{eur(cl.ca)}</Text>
          </View>
        ))}

        {/* Activité chauffeurs */}
        <Text style={s.sectionTitle}>Activite chauffeurs</Text>
        <View style={s.th}>
          <Text style={[s.thc, { width: '55%' }]}>Chauffeur</Text>
          <Text style={[s.thc, { width: '20%', textAlign: 'right' }]}>Missions</Text>
          <Text style={[s.thc, { width: '25%', textAlign: 'right' }]}>Cout paie</Text>
        </View>
        {rapport.operationnel.activiteChauffeurs.slice(0, 10).map((ch, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={[s.td, { width: '55%' }]}>{safe(ch.nom)}</Text>
            <Text style={[s.td, { width: '20%', textAlign: 'right' }]}>{ch.missions}</Text>
            <Text style={[s.td, { width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{eur(ch.cout)}</Text>
          </View>
        ))}

        <View style={s.footer} fixed>
          {societe.mentions_legales ? <Text style={s.footerTxt}>{safe(societe.mentions_legales)}</Text> : null}
          <Text style={s.footerTxt}>Document interne - genere automatiquement</Text>
        </View>
      </Page>
    </Document>
  )
}

function Kpi({ label, val, color = NOIR }: { label: string; val: string; color?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiVal, { color }]}>{val}</Text>
    </View>
  )
}

export async function renderRapportBuffer(data: RapportPDFData): Promise<Buffer> {
  return renderToBuffer(<Doc {...data} />)
}
