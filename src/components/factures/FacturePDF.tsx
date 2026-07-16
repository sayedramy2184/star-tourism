// Server-only — génère le PDF d'une facture via @react-pdf/renderer.
// Utilise les polices standard (Times/Helvetica) pour un rendu 100% serverless,
// sans dépendance réseau au moment du rendu.

import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from '@react-pdf/renderer'

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
}

function eur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0)
}
function dateFr(d: string) {
  const [y, m, j] = d.split('-')
  return j && m && y ? `${j}/${m}/${y}` : d
}

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 64, paddingHorizontal: 44, fontSize: 9, fontFamily: 'Helvetica', color: NOIR },

  // En-tête
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  brandMark: { flexDirection: 'row', alignItems: 'center' },
  brandBox: { width: 22, height: 22, borderWidth: 1, borderColor: OR, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  brandBoxTxt: { fontFamily: 'Times-Roman', fontSize: 12, color: OR },
  brandName: { fontFamily: 'Times-Roman', fontSize: 15, letterSpacing: 3, color: NOIR },
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

function FactureDocument({ facture, lignes, client, societe, dossierNumero }: FacturePDFData) {
  const villeLigne = [societe.code_postal, societe.ville].filter(Boolean).join(' ')
  const clientVille = [client.code_postal, client.ville].filter(Boolean).join(' ')
  const legalParts = [
    societe.forme_juridique && societe.nom ? `${societe.nom} — ${societe.forme_juridique}` : societe.nom,
    societe.siret ? `SIRET ${societe.siret}` : null,
    societe.numero_tva ? `TVA ${societe.numero_tva}` : null,
    villeLigne ? `${societe.adresse ?? ''}${societe.adresse ? ', ' : ''}${villeLigne}` : societe.adresse,
  ].filter(Boolean).join('  ·  ')

  return (
    <Document title={`${facture.type === 'avoir' ? 'Avoir' : 'Facture'} ${facture.numero}`} author={societe.nom ?? 'Star Tourism Services'}>
      <Page size="A4" style={styles.page}>

        {/* En-tête : marque + société émettrice */}
        <View style={styles.header}>
          <View>
            <View style={styles.brandMark}>
              <View style={styles.brandBox}><Text style={styles.brandBoxTxt}>S</Text></View>
              <Text style={styles.brandName}>STAR TOURISM</Text>
            </View>
            <Text style={styles.brandSub}>Services Drive</Text>
          </View>
          <View style={styles.societeBlock}>
            <Text style={styles.societeNom}>{societe.nom ?? 'Ma société'}</Text>
            {societe.adresse ? <Text style={styles.societeLine}>{societe.adresse}</Text> : null}
            {villeLigne ? <Text style={styles.societeLine}>{villeLigne}</Text> : null}
            {societe.telephone ? <Text style={styles.societeLine}>{societe.telephone}</Text> : null}
            {societe.email ? <Text style={styles.societeLine}>{societe.email}</Text> : null}
          </View>
        </View>

        {/* Titre + numéro */}
        <View style={styles.titleRow}>
          <Text style={styles.factureTitle}>{facture.type === 'avoir' ? 'Avoir' : 'Facture'}</Text>
          <Text style={styles.factureNum}>{facture.numero}</Text>
        </View>

        {/* Méta : dates + dossier */}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date d'émission</Text>
            <Text style={styles.metaVal}>{dateFr(facture.date_emission)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Échéance</Text>
            <Text style={styles.metaVal}>{dateFr(facture.date_echeance)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Référence dossier</Text>
            <Text style={styles.metaVal}>{dossierNumero ?? '—'}</Text>
          </View>
        </View>

        {/* Client */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Facturé à</Text>
          <Text style={styles.billToNom}>{client.nom}</Text>
          {client.contact_nom ? <Text style={styles.billToLine}>À l'attention de {client.contact_nom}</Text> : null}
          {client.adresse ? <Text style={styles.billToLine}>{client.adresse}</Text> : null}
          {clientVille ? <Text style={styles.billToLine}>{clientVille}{client.pays && client.pays !== 'France' ? `, ${client.pays}` : ''}</Text> : null}
          {client.numero_tva ? <Text style={styles.billToLine}>TVA : {client.numero_tva}</Text> : null}
        </View>

        {/* Tableau des lignes */}
        <View style={styles.tHead}>
          <Text style={[styles.tHeadCell, styles.cDesc]}>Désignation</Text>
          <Text style={[styles.tHeadCell, styles.cQte]}>Qté</Text>
          <Text style={[styles.tHeadCell, styles.cPu]}>P.U. HT</Text>
          <Text style={[styles.tHeadCell, styles.cTot]}>Montant HT</Text>
        </View>
        {lignes.map((l, i) => (
          <View key={i} style={styles.tRow} wrap={false}>
            <View style={styles.cDesc}>
              <Text style={styles.desigTxt}>{l.designation}</Text>
              {l.description ? <Text style={styles.descTxt}>{l.description}</Text> : null}
              {l.reference ? <Text style={styles.refTxt}>Réf. {l.reference}</Text> : null}
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
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalVal}>{eur(facture.montant_ht)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA {facture.taux_tva} %</Text>
              <Text style={styles.totalVal}>{eur(facture.montant_tva)}</Text>
            </View>
            <View style={styles.ttcRow}>
              <Text style={styles.ttcLabel}>Total TTC</Text>
              <Text style={styles.ttcVal}>{eur(facture.montant_ttc)}</Text>
            </View>
          </View>
        </View>

        {/* Paiement */}
        <View style={styles.payBlock}>
          <View style={styles.payCol}>
            <Text style={styles.payLabel}>Conditions de règlement</Text>
            <Text style={styles.payLine}>{societe.conditions_paiement ?? 'Paiement à 30 jours'}</Text>
            <Text style={styles.payLine}>Échéance : {dateFr(facture.date_echeance)}</Text>
          </View>
          {(societe.iban || societe.bic) ? (
            <View style={styles.payCol}>
              <Text style={styles.payLabel}>Coordonnées bancaires</Text>
              {societe.banque ? <Text style={styles.payLine}>{societe.banque}</Text> : null}
              {societe.iban ? <Text style={styles.payMono}>IBAN {societe.iban}</Text> : null}
              {societe.bic ? <Text style={styles.payMono}>BIC {societe.bic}</Text> : null}
            </View>
          ) : null}
        </View>

        {facture.notes ? <Text style={styles.notes}>{facture.notes}</Text> : null}

        {/* Pied de page — mentions légales */}
        <View style={styles.footer} fixed>
          {societe.mentions_legales ? <Text style={styles.footerTxt}>{societe.mentions_legales}</Text> : null}
          {legalParts ? <Text style={styles.footerTxt}>{legalParts}</Text> : null}
        </View>

      </Page>
    </Document>
  )
}

export async function renderFactureBuffer(data: FacturePDFData): Promise<Buffer> {
  return renderToBuffer(<FactureDocument {...data} />)
}
