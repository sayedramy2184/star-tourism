// Server-only — génère le PDF du décompte d'un loueur via @react-pdf/renderer.
// Polices standard (Helvetica) pour un rendu 100% serverless.
import React from 'react'
import fs from 'fs'
import path from 'path'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

let LOGO_DATA: string | null = null
for (const nom of ['logo-facture.png', 'logo.png']) {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', nom))
    LOGO_DATA = `data:image/png;base64,${buf.toString('base64')}`
    break
  } catch { /* essai suivant */ }
}

const OR = '#9a7a28', NOIR = '#16130e', GRIS = '#5a564e', LIGNE = '#d8d2c8', CREME = '#f5f2ed'

export interface LoueurPDFVehicule {
  vehicule: string
  immatriculation: string | null
  loyer: string
  depuis: string
  jours: number
  coutCouru: number
  actif: boolean
}
export interface LoueurPDFData {
  loueur: { nom: string; contact_nom: string | null; telephone: string | null; email: string | null; adresse: string | null; notes: string | null }
  vehicules: LoueurPDFVehicule[]
  paiements: { montant: number; date_paiement: string; moyen: string | null; note: string | null }[]
  totals: { coutCouru: number; paye: number; solde: number }
  societe: { nom: string | null; adresse: string | null; code_postal: string | null; ville: string | null; telephone: string | null; email: string | null; siret: string | null; numero_tva: string | null; mentions_legales: string | null }
  dateEdition: string
}

function eur(n: number) {
  const v = n ?? 0
  const neg = v < 0
  const [ent, dec] = Math.abs(v).toFixed(2).split('.')
  return `${neg ? '-' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${dec} EUR`
}
function safe(s: string | null | undefined): string {
  if (!s) return ''
  return String(s).replace(/[  ]/g, ' ').replace(/[→➔➜]/g, '-').replace(/[‘’′]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[…]/g, '...')
}
function fmtDate(d: string) {
  const [y, m, j] = d.split('-')
  return j ? `${j}/${m}/${y}` : d
}
const MOYENS: Record<string, string> = { virement: 'Virement', especes: 'Especes', cheque: 'Cheque', carte: 'Carte', autre: 'Autre' }

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 44, fontSize: 9, fontFamily: 'Helvetica', color: NOIR },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 },
  brandLogo: { width: 130, objectFit: 'contain' },
  brandName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: NOIR, letterSpacing: 1 },
  societeBlock: { alignItems: 'flex-end' },
  societeNom: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NOIR },
  societeLine: { fontSize: 8.5, color: GRIS, marginTop: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: NOIR, paddingBottom: 6, marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: NOIR },
  titleDate: { fontSize: 9, color: GRIS },
  billTo: { backgroundColor: CREME, padding: 12, marginBottom: 18 },
  billToLabel: { fontSize: 7.5, letterSpacing: 1.5, color: OR, fontFamily: 'Helvetica-Bold', marginBottom: 4, textTransform: 'uppercase' },
  billToNom: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NOIR },
  billToLine: { fontSize: 8.5, color: GRIS, marginTop: 2 },
  tHead: { flexDirection: 'row', backgroundColor: NOIR, paddingVertical: 5, paddingHorizontal: 6 },
  tHeadCell: { fontSize: 7.5, color: '#fff', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  tRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: LIGNE },
  cVeh: { width: '40%' }, cLoyer: { width: '17%' }, cDepuis: { width: '15%' }, cJours: { width: '10%', textAlign: 'right' }, cCout: { width: '18%', textAlign: 'right' },
  txt: { fontSize: 9, color: NOIR }, mono: { fontSize: 9, color: NOIR }, sub: { fontSize: 7.5, color: GRIS, marginTop: 1 },
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
  totalsBox: { width: '55%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LIGNE },
  totalLabel: { fontSize: 9, color: GRIS }, totalVal: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NOIR },
  soldeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, backgroundColor: NOIR, marginTop: 4 },
  soldeLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  soldeVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff' },
  sectionTitle: { fontSize: 8, letterSpacing: 1.5, color: OR, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LIGNE },
  footer: { position: 'absolute', bottom: 30, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: LIGNE, paddingTop: 8 },
  footerTxt: { fontSize: 7, color: GRIS, textAlign: 'center' },
})

function LoueurDocument({ loueur, vehicules, paiements, totals, societe, dateEdition }: LoueurPDFData) {
  const villeLigne = [societe.code_postal, societe.ville].filter(Boolean).join(' ')
  const legal = [societe.siret ? `SIRET ${societe.siret}` : null, societe.numero_tva ? `TVA ${societe.numero_tva}` : null].filter(Boolean).join('  ·  ')
  return (
    <Document title={`Decompte loueur - ${loueur.nom}`} author={societe.nom ?? 'Star Tourism Services'}>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View>
            {LOGO_DATA ? <Image src={LOGO_DATA} style={styles.brandLogo} /> : <Text style={styles.brandName}>STAR TOURISME SERVICES</Text>}
          </View>
          <View style={styles.societeBlock}>
            <Text style={styles.societeNom}>{safe(societe.nom) || 'Ma societe'}</Text>
            {societe.adresse ? <Text style={styles.societeLine}>{safe(societe.adresse)}</Text> : null}
            {villeLigne ? <Text style={styles.societeLine}>{safe(villeLigne)}</Text> : null}
            {societe.telephone ? <Text style={styles.societeLine}>{safe(societe.telephone)}</Text> : null}
            {societe.email ? <Text style={styles.societeLine}>{safe(societe.email)}</Text> : null}
          </View>
        </View>

        {/* Titre */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Decompte loueur</Text>
          <Text style={styles.titleDate}>Edite le {fmtDate(dateEdition)}</Text>
        </View>

        {/* Loueur */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Loueur</Text>
          <Text style={styles.billToNom}>{safe(loueur.nom)}</Text>
          {loueur.contact_nom ? <Text style={styles.billToLine}>Contact : {safe(loueur.contact_nom)}</Text> : null}
          {loueur.adresse ? <Text style={styles.billToLine}>{safe(loueur.adresse)}</Text> : null}
          {(loueur.telephone || loueur.email) ? <Text style={styles.billToLine}>{[loueur.telephone, loueur.email].filter(Boolean).map(safe).join('  ·  ')}</Text> : null}
        </View>

        {/* Tableau véhicules */}
        <View style={styles.tHead}>
          <Text style={[styles.tHeadCell, styles.cVeh]}>Vehicule</Text>
          <Text style={[styles.tHeadCell, styles.cLoyer]}>Loyer</Text>
          <Text style={[styles.tHeadCell, styles.cDepuis]}>Depuis</Text>
          <Text style={[styles.tHeadCell, styles.cJours]}>Jours</Text>
          <Text style={[styles.tHeadCell, styles.cCout]}>Cout couru HT</Text>
        </View>
        {vehicules.length === 0 ? (
          <View style={styles.tRow}><Text style={[styles.txt, { color: GRIS }]}>Aucun vehicule rattache a ce loueur.</Text></View>
        ) : vehicules.map((v, i) => (
          <View key={i} style={styles.tRow} wrap={false}>
            <View style={styles.cVeh}>
              <Text style={styles.txt}>{safe(v.vehicule)}{v.actif ? '' : '  (termine)'}</Text>
              {v.immatriculation ? <Text style={styles.sub}>{safe(v.immatriculation)}</Text> : null}
            </View>
            <Text style={[styles.mono, styles.cLoyer]}>{safe(v.loyer)}</Text>
            <Text style={[styles.txt, styles.cDepuis]}>{safe(v.depuis)}</Text>
            <Text style={[styles.mono, styles.cJours]}>{v.jours || '-'}</Text>
            <Text style={[styles.mono, styles.cCout]}>{eur(v.coutCouru)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Cout couru HT</Text><Text style={styles.totalVal}>{eur(totals.coutCouru)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Total verse</Text><Text style={styles.totalVal}>{eur(totals.paye)}</Text></View>
            <View style={styles.soldeRow}>
              <Text style={styles.soldeLabel}>{totals.solde > 0 ? 'Reste a payer' : 'Solde'}</Text>
              <Text style={styles.soldeVal}>{eur(Math.max(0, totals.solde))}</Text>
            </View>
          </View>
        </View>

        {/* Paiements */}
        {paiements.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Versements</Text>
            {paiements.map((p, i) => (
              <View key={i} style={styles.payRow} wrap={false}>
                <Text style={styles.txt}>
                  {fmtDate(p.date_paiement)}
                  {p.moyen ? `   ${MOYENS[p.moyen] ?? p.moyen}` : ''}
                  {p.note ? `   ${safe(p.note)}` : ''}
                </Text>
                <Text style={styles.totalVal}>{eur(Number(p.montant))}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          {societe.mentions_legales ? <Text style={styles.footerTxt}>{safe(societe.mentions_legales)}</Text> : null}
          {legal ? <Text style={styles.footerTxt}>{safe(legal)}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}

export async function renderLoueurBuffer(data: LoueurPDFData): Promise<Buffer> {
  return renderToBuffer(<LoueurDocument {...data} />)
}
