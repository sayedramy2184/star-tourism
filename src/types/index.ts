// ─────────────────────────────────────────────
//  STAR TOURISM SERVICES — Types TypeScript
//  Reflète exactement le schéma Supabase
// ─────────────────────────────────────────────

// ── Multi-tenant ──────────────────────────────

export type UserRole = 'admin' | 'dispatcher' | 'chauffeur'

export interface Company {
  id: string
  nom: string
  slug: string
  plan: 'solo' | 'pro' | 'enterprise'
  actif: boolean
  created_at: string
}

export interface Profile {
  id: string            // = auth.users.id
  company_id: string
  role: UserRole
  nom: string
  prenom: string
  email: string
  telephone: string | null
  avatar_url: string | null
  actif: boolean
  created_at: string
}

// ── Clients ───────────────────────────────────

export interface Passager {
  id: string
  company_id: string
  dossier_id: string
  nom: string
  nationalite: string | null
  telephone: string | null
  nb_bagages: number
  notes: string | null
  created_at: string
}

export interface Client {
  id: string
  company_id: string
  type: 'particulier' | 'entreprise' | 'agence'
  nom: string                         // nom complet ou raison sociale
  contact_nom: string | null          // si entreprise
  email: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  pays: string
  numero_tva: string | null
  notes: string | null
  created_at: string
}

// ── Chauffeurs ────────────────────────────────

export interface Chauffeur {
  id: string
  company_id: string
  profile_id: string | null           // lien vers auth si compte app
  nom: string
  prenom: string
  telephone: string
  email: string | null
  statut: 'disponible' | 'en_mission' | 'indisponible' | 'conge'
  vtc_card_numero: string | null
  vtc_card_expiry: string | null      // date ISO
  permis_expiry: string | null
  notes: string | null
  created_at: string
  // Fiche enrichie
  matricule: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  date_naissance: string | null
  nationalite: string | null
  interne: boolean | null
  coefficient: number | null
  date_embauche: string | null
  visite_medicale_date: string | null
  visite_medicale_expiry: string | null
  carte_sejour_numero: string | null
  carte_sejour_expiry: string | null
  carte_qualif_expiry: string | null
  langues: string[] | null
  competences: string[] | null
}

export const LANGUES = [
  { key: 'francais', label: 'Français' }, { key: 'anglais', label: 'Anglais' },
  { key: 'espagnol', label: 'Espagnol' }, { key: 'allemand', label: 'Allemand' },
  { key: 'italien', label: 'Italien' }, { key: 'arabe', label: 'Arabe' },
  { key: 'chinois', label: 'Chinois' }, { key: 'russe', label: 'Russe' },
] as const

export const COMPETENCES = [
  { key: 'bodyguard', label: 'Bodyguard' }, { key: 'guide', label: 'Guide touristique' },
  { key: 'secouriste', label: 'Secouriste' }, { key: 'tpmr', label: 'TPMR' },
  { key: 'permis_d', label: 'Permis D' },
] as const

// ── Sous-traitants ────────────────────────────

export interface SousTraitant {
  id: string
  company_id: string
  societe: string
  contact_nom: string | null
  telephone: string | null
  email: string | null
  siret: string | null
  notes: string | null
  created_at: string
}

// ── Véhicules ─────────────────────────────────

export type VehiculeCategorie =
  | 'berline_standard'
  | 'berline_premium'
  | 'berline_prestige'
  | 'van_minibus'
  | 'van_bagages'
  | 'suv_premium'
  | 'electrique'

export type VehiculeStatut = 'disponible' | 'en_mission' | 'maintenance' | 'inactif'

export interface Vehicule {
  id: string
  company_id: string
  marque: string
  modele: string
  immatriculation: string
  annee: number | null
  categorie: VehiculeCategorie
  nb_places: number
  couleur: string | null
  statut: VehiculeStatut
  ct_date: string | null              // contrôle technique
  assurance_date: string | null
  kilometrage: number | null
  chauffeur_id: string | null         // chauffeur principal affecté
  notes: string | null
  created_at: string
}

export interface VehiculeExterne {
  id: string
  company_id: string
  marque: string
  modele: string
  immatriculation: string | null
  loueur: string | null               // ex: Hertz Paris CDG
  cout_ht: number | null              // coût de location
  notes: string | null
  created_at: string
}

// ── Dossiers ──────────────────────────────────

export type DossierStatut =
  | 'brouillon'
  | 'en_attente'
  | 'confirme'
  | 'en_cours'
  | 'termine'
  | 'annule'

export interface Dossier {
  id: string
  company_id: string
  numero: string                      // DOS-2026-001
  client_id: string
  date_debut: string                  // ISO date
  date_fin: string                    // ISO date
  nb_jours: number                    // calculé
  statut: DossierStatut
  montant_ht: number                  // calculé depuis prestations
  montant_tva: number
  montant_ttc: number
  notes: string | null
  created_by: string                  // profile_id
  created_at: string
  updated_at: string
  // Relations (join)
  client?: Client
  prestations?: Prestation[]
}

// ── Prestations ───────────────────────────────

export type PrestationType = 'mad' | 'transfert'

export type PrestationStatut =
  | 'en_attente'
  | 'confirme'
  | 'en_cours'
  | 'termine'
  | 'annule'

export interface Prestation {
  id: string
  company_id: string
  dossier_id: string
  ordre: number                       // ordre d'affichage dans le dossier
  type: PrestationType
  statut: PrestationStatut

  // Dates
  date_debut: string
  date_fin: string                    // = date_debut pour transfert ponctuel
  nb_jours: number

  // Transfert
  heure_depart: string | null         // HH:MM
  adresse_depart: string | null
  adresse_arrivee: string | null

  // Suivi vol / train (transfert aéroport / gare)
  vol_numero: string | null
  vol_heure: string | null
  vol_ville: string | null
  vol_terminal: string | null
  vol_arrivee: boolean | null

  // MAD
  heure_debut_journee: string | null  // ex: 09:00
  heure_fin_journee: string | null    // ex: 18:00

  // Tarification
  tarif_journalier_ht: number | null  // pour MAD
  tarif_fixe_ht: number | null        // pour transfert
  montant_ht: number                  // calculé

  // Véhicule
  modele_souhaite: string | null      // texte libre
  vehicule_id: string | null          // flotte interne
  vehicule_ext_id: string | null      // véhicule externe
  affectation_differee: boolean       // true = affecter plus tard

  // Chauffeur (pour transfert ponctuel)
  chauffeur_id: string | null

  // Passagers
  nb_passagers: number
  nb_bagages: number
  passager_ids: string[] | null

  // Sous-traitance (affectation externe)
  sous_traitant_id: string | null
  st_chauffeur_nom: string | null
  st_chauffeur_telephone: string | null
  st_vehicule_marque: string | null
  st_vehicule_modele: string | null
  st_vehicule_immat: string | null
  st_cout_ht: number | null           // coût total facturé par le sous-traitant
  st_marge_ht: number | null          // marge = prix client − coût sous-traitant
  st_paiement_statut: 'non_paye' | 'paye' | null
  st_paiement_date: string | null
  st_paiement_ref: string | null

  notes: string | null
  created_at: string

  // Relations
  vehicule?: Vehicule
  vehicule_ext?: VehiculeExterne
  chauffeur?: Chauffeur
  sous_traitant?: SousTraitant
  jours?: JourMad[]
}

// ── Jours MAD ─────────────────────────────────

export interface JourMad {
  id: string
  company_id: string
  prestation_id: string
  date: string                        // ISO date
  jour_semaine: string                // Lun, Mar...
  chauffeur_id: string | null
  sous_traitant_id: string | null     // affectation externe pour ce jour
  vehicule_id: string | null          // peut surcharger le véhicule principal
  vehicule_ext_id: string | null
  tarif_ht: number                    // peut être différent du tarif journalier (fériés, etc.)
  note: string | null
  statut: 'en_attente' | 'confirme' | 'termine'
  created_at: string
  // Relations
  chauffeur?: Chauffeur
  vehicule?: Vehicule
}

// ── Affectations ──────────────────────────────
// Table centralisée pour le planning

export interface Affectation {
  id: string
  company_id: string
  date: string
  heure_debut: string | null
  heure_fin: string | null
  chauffeur_id: string
  vehicule_id: string | null
  vehicule_ext_id: string | null
  prestation_id: string | null
  jour_mad_id: string | null
  notes: string | null
  created_at: string
}

// ── Factures ──────────────────────────────────

export type FactureStatut = 'brouillon' | 'emise' | 'envoyee' | 'payee' | 'en_retard' | 'annulee'

export interface Facture {
  id: string
  company_id: string
  numero: string                      // FAC-2026-001
  dossier_id: string | null
  client_id: string
  statut: FactureStatut
  date_emission: string
  date_echeance: string
  montant_ht: number
  taux_tva: number                    // 10 pour VTC par défaut
  montant_tva: number
  montant_ttc: number
  notes: string | null
  pdf_url: string | null              // stocké dans Supabase Storage
  created_at: string
  updated_at: string
  // Relations
  client?: Client
  dossier?: Dossier
  lignes?: LigneFacture[]
}

export interface LigneFacture {
  id: string
  facture_id: string
  ordre: number
  designation: string
  description: string | null
  reference: string | null            // ex: MSN-2607
  quantite: number
  prix_unitaire_ht: number
  montant_ht: number
  created_at: string
}

// ── Utilitaires ───────────────────────────────

export type ApiResponse<T> = {
  data: T | null
  error: string | null
}

export type PaginatedResponse<T> = {
  data: T[]
  count: number
  page: number
  per_page: number
}

// Filtres pour les listes
export interface DossierFilters {
  statut?: DossierStatut
  client_id?: string
  date_debut?: string
  date_fin?: string
  search?: string
}

export interface VehiculeFilters {
  statut?: VehiculeStatut
  categorie?: VehiculeCategorie
}
