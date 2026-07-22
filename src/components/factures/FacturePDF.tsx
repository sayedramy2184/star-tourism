// Server-only — génère le PDF d'une facture via @react-pdf/renderer.
// Utilise les polices standard (Times/Helvetica) pour un rendu 100% serverless,
// sans dépendance réseau au moment du rendu.

import React from 'react'
import fs from 'fs'
import path from 'path'
import {
  Document, Page, Text, View, Image, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

// Logo société — lu une seule fois et embarqué en data-URI.
// Priorité au logo dédié aux factures (logo-facture.png), sinon le logo de l'app.
let LOGO_DATA: string | null = null
for (const nom of ['logo-facture.png', 'logo.png']) {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), 'public', nom))
    LOGO_DATA = `data:image/png;base64,${buf.toString('base64')}`
    break
  } catch { /* essai suivant */ }
}

// ── Couleurs de marque ────────────────────────
const OR    = '#9a7a28'
const NOIR  = '#16130e'
const GRIS  = '#5a564e'
const LIGNE = '#d8d2c8'
const CREME = '#f5f2ed'

// ── Données ───────────────────────────────────
export interface FactureLigne {
  designation: string
  description: string | null
  reference: string | null
  quantite: number
  prix_unitaire_ht: number
  montant_ht: number
}

export interface FacturePDFData {
  facture: {
    numero: string
    type?: string
    date_emission: string
    date_echeance: string
    montant_ht: number
    taux_tva: number
    montant_tva: number
    montant_ttc: number
    notes: string | null
    statut: string
  }
  lignes: FactureLigne[]
  client: {
    nom: string
    contact_nom: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
    pays: string | null
    email: string | null
    telephone: string | null
    numero_tva: string | null
  }
  societe: {
    nom: string | null
    forme_juridique: string | null
    siret: string | null
    numero_tva: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
    telephone: string | null
    email: string | null
    site_web: string | null
    iban: string | null
    bic: string | null
    banque: string | null
    mentions_legales: string | null
    conditions_paiement: string | null
  }
  dossierNumero: string | null
  langue?: Langue
}

export type Langue = 'fr' | 'en'

// ── Libellés bilingues ────────────────────────
const LABELS = {
  fr: {
    facture: 'Facture', avoir: 'Avoir',
    dateEmission: "Date d'émission", echeance: 'Échéance', refDossier: 'Référence dossier',
    factureA: 'Facturé à', attention: "À l'attention de", tva: 'TVA', tvaShort: 'TVA',
    designation: 'Désignation', qte: 'Qté', puHt: 'P.U. HT', montantHt: 'Montant HT',
    ref: 'Réf.', totalHt: 'Total HT', tvaRow: 'TVA', totalTtc: 'Total TTC',
    conditions: 'Conditions de règlement', echeanceLigne: 'Échéance', paiementDefaut: 'Paiement à 30 jours',
    banque: 'Coordonnées bancaires',
  },
  en: {
    facture: 'Invoice', avoir: 'Credit note',
    dateEmission: 'Issue date', echeance: 'Due date', refDossier: 'Reference',
    factureA: 'Bill to', attention: 'Attn:', tva: 'VAT', tvaShort: 'VAT',
    designation: 'Description', qte: 'Qty', puHt: 'Unit price', montantHt: 'Amount',
    ref: 'Ref.', totalHt: 'Subtotal', tvaRow: 'VAT', totalTtc: 'Total',
    conditions: 'Payment terms', echeanceLigne: 'Due', paiementDefaut: 'Payment within 30 days',
    banque: 'Bank details',
  },
} as const

// Traduction des désignations standard (les seules générées automatiquement).
// Le texte libre (prestations libres, factures manuelles) est laissé tel quel.
const DESIGNATIONS_EN: Record<string, string> = {
  'Mise à disposition avec chauffeur': 'Chauffeur service (daily hire)',
  'Transfert privé avec chauffeur': 'Private transfer with chauffeur',
  'Meet & Greet': 'Meet & Greet',
}
function designation(s: string, langue: Langue): string {
  return langue === 'en' ? (DESIGNATIONS_EN[s] ?? s) : s
}

// Conditions de règlement traduites (mappe les formulations courantes, sinon texte d'origine).
function conditionsRglt(s: string | null | undefined, langue: Langue): string {
  const d = LABELS[langue].paiementDefaut
  if (!s) return d
  if (langue === 'fr') return safe(s)
  if (/imm[ée]diat/i.test(s)) return 'Payment on receipt'
  const m = s.match(/(\d+)/)
  if (m) return `Payment within ${m[1]} days`
  return safe(s)
}

const MOIS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Formatage € en ASCII pur : les polices standard du PDF (Helvetica) ne savent pas
// dessiner l'espace insécable étroit (U+202F) qu'insère Intl.NumberFormat('fr-FR'),
// d'où l'affichage « 5/200 ». On construit le séparateur de milliers à la main.
function eur(n: number) {
  const v = n ?? 0
  const neg = v < 0
  const [ent, dec] = Math.abs(v).toFixed(2).split('.')
  const entSep = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${neg ? '-' : ''}${entSep},${dec} €`
}

// Assainit un texte libre pour les polices standard du PDF (Latin-1 uniquement) :
// flèches, espaces insécables et guillemets typographiques → équivalents ASCII.
function safe(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/[  ]/g, ' ')
    .replace(/[→➔➜]/g, '-')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[…]/g, '...')
}
// FR : jj/mm/aaaa · EN : 21 Jul 2026 (évite l'ambiguïté jour/mois anglo-saxonne)
function fmtDate(d: string, langue: Langue = 'fr') {
  const [y, m, j] = d.split('-')
  if (!(j && m && y)) return d
  if (langue === 'en') return `${j} ${MOIS_EN[parseInt(m, 10) - 1] ?? m} ${y}`
  return `${j}/${m}/${y}`
}

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 44, fontSize: 9, fontFamily: 'Helvetica', color: NOIR },

  // En-tête
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  brandMark: { flexDirection: 'row', alignItems: 'center' },
  brandBox: { width: 22, height: 22, borderWidth: 1, borderColor: OR, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  brandLogo: { width: 84, height: 84, objectFit: 'contain' },
  brandBoxTxt: { fontFamily: 'Times-Roman', fontSize: 12, color: OR },
  brandName: { fontFamily: 'Times-Roman', fontSize: 13, letterSpacing: 2, lineHeight: 1.25, color: NOIR },
  brandSub: { fontSize: 6, letterSpacing: 2, color: '#9c968b', marginTop: 3, textTransform: 'uppercase' },
  societeBlock: { textAlign: 'right', maxWidth: 240 },
  societeNom: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: NOIR },
  societeLine: { fontSize: 8, color: GRIS, marginTop: 2 },

  // Titre facture
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  factureTitle: { fontFamily: 'Times-Roman', fontSize: 26, color: NOIR },
  factureNum: { fontSize: 11, color: OR, fontFamily: 'Helvetica-Bold' },
  metaRow: { flexDirection: 'row', marginTop: 10, marginBottom: 22, borderTopWidth: 1.5, borderTopColor: OR, paddingTop: 10 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 6.5, letterSpacing: 1.5, color: '#9c968b', textTransform: 'uppercase', marginBottom: 3 },
  metaVal: { fontSize: 9, color: NOIR },

  // Client
  billTo: { backgroundColor: CREME, padding: 12, marginBottom: 22 },
  billToLabel: { fontSize: 6.5, letterSpacing: 2, color: OR, textTransform: 'uppercase', marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  billToNom: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NOIR },
  billToLine: { fontSize: 8.5, color: GRIS, marginTop: 2 },

  // Tableau
  tHead: { flexDirection: 'row', backgroundColor: NOIR, paddingVertical: 7, paddingHorizontal: 8 },
  tHeadCell: { fontSize: 7, letterSpacing: 1, color: '#fff', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  tRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LIGNE },
  cDesc: { flex: 4 },
  cQte: { flex: 1, textAlign: 'right' },
  cPu: { flex: 1.4, textAlign: 'right' },
  cTot: { flex: 1.4, textAlign: 'right' },
  desigTxt: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NOIR },
  descTxt: { fontSize: 7.5, color: GRIS, marginTop: 2 },
  refTxt: { fontSize: 7, color: '#9c968b', marginTop: 1 },
  numTxt: { fontSize: 9 },

  // Totaux
  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: LIGNE },
  totalLabel: { fontSize: 8, color: GRIS, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalVal: { fontSize: 9 },
  ttcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 9 },
  ttcLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  ttcVal: { fontFamily: 'Times-Roman', fontSize: 18, color: OR },

  // Paiement
  payBlock: { marginTop: 26, flexDirection: 'row', gap: 16 },
  payCol: { flex: 1, backgroundColor: CREME, padding: 11 },
  payLabel: { fontSize: 6.5, letterSpacing: 1.5, color: OR, textTransform: 'uppercase', marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  payLine: { fontSize: 8, color: GRIS, marginTop: 2 },
  payMono: { fontSize: 8.5, color: NOIR, marginTop: 2 },

  notes: { marginTop: 18, fontSize: 8, color: GRIS, fontStyle: 'italic', lineHeight: 1.5 },

  // Pied de page
  footer: { position: 'absolute', bottom: 28, left: 44, right: 44, borderTopWidth: 1, borderTopColor: LIGNE, paddingTop: 8 },
  footerTxt: { fontSize: 6.5, color: '#9c968b', textAlign: 'center', lineHeight: 1.4 },
})

function FactureDocument({ facture, lignes, client, societe, dossierNumero, langue = 'fr' }: FacturePDFData) {
  const L = LABELS[langue]
  const titre = facture.type === 'avoir' ? L.avoir : L.facture
  const villeLigne = [societe.code_postal, societe.ville].filter(Boolean).join(' ')
  const clientVille = [client.code_postal, client.ville].filter(Boolean).join(' ')
  const legalParts = [
    societe.forme_juridique && societe.nom ? `${societe.nom} — ${societe.forme_juridique}` : societe.nom,
    societe.siret ? `SIRET ${societe.siret}` : null,
    societe.numero_tva ? `TVA ${societe.numero_tva}` : null,
    villeLigne ? `${societe.adresse ?? ''}${societe.adresse ? ', ' : ''}${villeLigne}` : societe.adresse,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document title={`${titre} ${facture.numero}`} author={societe.nom ?? 'Star Tourism Services'}>
      <Page size="A4" style={styles.page}>

        {/* En-tête : marque + société émettrice */}
        <View style={styles.header}>
          <View style={styles.brandMark}>
            {LOGO_DATA
              ? <Image src={LOGO_DATA} style={styles.brandLogo} />
              : (
                <View>
                  <View style={styles.brandBox}><Text style={styles.brandBoxTxt}>S</Text></View>
                  <Text style={styles.brandName}>STAR TOURISME SERVICES</Text>
                </View>
              )}
          </View>
          <View style={styles.societeBlock}>
            <Text style={styles.societeNom}>{safe(societe.nom) || 'Ma société'}</Text>
            {societe.adresse ? <Text style={styles.societeLine}>{safe(societe.adresse)}</Text> : null}
            {villeLigne ? <Text style={styles.societeLine}>{safe(villeLigne)}</Text> : null}
            {societe.telephone ? <Text style={styles.societeLine}>{safe(societe.telephone)}</Text> : null}
            {societe.email ? <Text style={styles.societeLine}>{safe(societe.email)}</Text> : null}
          </View>
        </View>

        {/* Titre + numéro */}
        <View style={styles.titleRow}>
          <Text style={styles.factureTitle}>{titre}</Text>
          <Text style={styles.factureNum}>{facture.numero}</Text>
        </View>

        {/* Méta : dates + dossier */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{L.dateEmission}</Text>
            <Text style={styles.metaVal}>{fmtDate(facture.date_emission, langue)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{L.echeance}</Text>
            <Text style={styles.metaVal}>{fmtDate(facture.date_echeance, langue)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{L.refDossier}</Text>
            <Text style={styles.metaVal}>{dossierNumero ?? '—'}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>{L.factureA}</Text>
          <Text style={styles.billToNom}>{safe(client.nom)}</Text>
          {client.contact_nom ? <Text style={styles.billToLine}>{L.attention} {safe(client.contact_nom)}</Text> : null}
          {client.adresse ? <Text style={styles.billToLine}>{safe(client.adresse)}</Text> : null}
          {clientVille ? <Text style={styles.billToLine}>{safe(clientVille)}{client.pays && client.pays !== 'France' ? `, ${safe(client.pays)}` : ''}</Text> : null}
          {client.numero_tva ? <Text style={styles.billToLine}>{L.tvaShort}{langue === 'en' ? ':' : ' :'} {safe(client.numero_tva)}</Text> : null}
        </View>

        {/* Tableau des lignes */}
        <View style={styles.tHead}>
          <Text style={[styles.tHeadCell, styles.cDesc]}>{L.designation}</Text>
          <Text style={[styles.tHeadCell, styles.cQte]}>{L.qte}</Text>
          <Text style={[styles.tHeadCell, styles.cPu]}>{L.puHt}</Text>
          <Text style={[styles.tHeadCell, styles.cTot]}>{L.montantHt}</Text>
        </View>
        {lignes.map((l, i) => (
          <View key={i} style={styles.tRow} wrap={false}>
            <View style={styles.cDesc}>
              <Text style={styles.desigTxt}>{safe(designation(l.designation, langue))}</Text>
              {l.description ? <Text style={styles.descTxt}>{safe(l.description)}</Text> : null}
              {l.reference ? <Text style={styles.refTxt}>{L.ref} {safe(l.reference)}</Text> : null}
            </View>
            <Text style={[styles.numTxt, styles.cQte]}>{l.quantite}</Text>
            <Text style={[styles.numTxt, styles.cPu]}>{eur(l.prix_unitaire_ht)}</Text>
            <Text style={[styles.numTxt, styles.cTot]}>{eur(l.montant_ht)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={styles.totalsWrap}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{L.totalHt}</Text>
              <Text style={styles.totalVal}>{eur(facture.montant_ht)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{L.tvaRow} {facture.taux_tva}{langue === 'en' ? '%' : ' %'}</Text>
              <Text style={styles.totalVal}>{eur(facture.montant_tva)}</Text>
            </View>
            <View style={styles.ttcRow}>
              <Text style={styles.ttcLabel}>{L.totalTtc}</Text>
              <Text style={styles.ttcVal}>{eur(facture.montant_ttc)}</Text>
            </View>
          </View>
        </View>

        {/* Paiement */}
        <View style={styles.payBlock}>
          <View style={styles.payCol}>
            <Text style={styles.payLabel}>{L.conditions}</Text>
            <Text style={styles.payLine}>{conditionsRglt(societe.conditions_paiement, langue)}</Text>
            <Text style={styles.payLine}>{L.echeanceLigne}{langue === 'en' ? ':' : ' :'} {fmtDate(facture.date_echeance, langue)}</Text>
          </View>
          {(societe.iban || societe.bic) ? (
            <View style={styles.payCol}>
              <Text style={styles.payLabel}>{L.banque}</Text>
              {societe.banque ? <Text style={styles.payLine}>{safe(societe.banque)}</Text> : null}
              {societe.iban ? <Text style={styles.payMono}>IBAN {safe(societe.iban)}</Text> : null}
              {societe.bic ? <Text style={styles.payMono}>BIC {safe(societe.bic)}</Text> : null}
            </View>
          ) : null}
        </View>

        {facture.notes ? <Text style={styles.notes}>{safe(facture.notes)}</Text> : null}

        {/* Pied de page — mentions légales */}
        <View style={styles.footer} fixed>
          {societe.mentions_legales ? <Text style={styles.footerTxt}>{safe(societe.mentions_legales)}</Text> : null}
          {legalParts ? <Text style={styles.footerTxt}>{safe(legalParts)}</Text> : null}
        </View>

      </Page>
    </Document>
  )
}

export async function renderFactureBuffer(data: FacturePDFData): Promise<Buffer> {
  return renderToBuffer(<FactureDocument {...data} />)
}
