-- ═══════════════════════════════════════════════════════════════
--  ÉLITE DRIVE — Schéma Supabase complet
--  À exécuter dans Supabase > SQL Editor
--  Multi-tenant avec Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════

-- Extensions
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────
--  1. COMPANIES (sociétés VTC)
-- ──────────────────────────────────────────────
create table companies (
  id          uuid primary key default uuid_generate_v4(),
  nom         text not null,
  slug        text not null unique,             -- ex: elite-drive
  plan        text not null default 'solo' check (plan in ('solo','pro','enterprise')),
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  2. PROFILES (utilisateurs de l'app)
--     Lié à auth.users de Supabase
-- ──────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  role        text not null default 'dispatcher' check (role in ('admin','dispatcher','chauffeur')),
  nom         text not null,
  prenom      text not null,
  email       text not null,
  telephone   text,
  avatar_url  text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  3. CLIENTS
-- ──────────────────────────────────────────────
create table clients (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  type          text not null default 'entreprise' check (type in ('particulier','entreprise')),
  nom           text not null,
  contact_nom   text,
  email         text,
  telephone     text,
  adresse       text,
  ville         text,
  code_postal   text,
  pays          text not null default 'France',
  numero_tva    text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  4. CHAUFFEURS
-- ──────────────────────────────────────────────
create table chauffeurs (
  id                uuid primary key default uuid_generate_v4(),
  company_id        uuid not null references companies(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete set null,
  nom               text not null,
  prenom            text not null,
  telephone         text not null,
  email             text,
  statut            text not null default 'disponible'
                    check (statut in ('disponible','en_mission','indisponible','conge')),
  vtc_card_numero   text,
  vtc_card_expiry   date,
  permis_expiry     date,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  5. SOUS-TRAITANTS
-- ──────────────────────────────────────────────
create table sous_traitants (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  societe       text not null,
  contact_nom   text,
  telephone     text,
  email         text,
  siret         text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  6. VÉHICULES (flotte interne)
-- ──────────────────────────────────────────────
create table vehicules (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  marque          text not null,
  modele          text not null,
  immatriculation text not null,
  annee           integer,
  categorie       text not null default 'berline_standard'
                  check (categorie in (
                    'berline_standard','berline_premium','berline_prestige',
                    'van_minibus','suv_premium','electrique'
                  )),
  nb_places       integer not null default 4,
  couleur         text,
  statut          text not null default 'disponible'
                  check (statut in ('disponible','en_mission','maintenance','inactif')),
  ct_date         date,
  assurance_date  date,
  kilometrage     integer,
  chauffeur_id    uuid references chauffeurs(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  7. VÉHICULES EXTERNES (loués ponctuellement)
-- ──────────────────────────────────────────────
create table vehicules_ext (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  marque          text not null,
  modele          text not null,
  immatriculation text,
  loueur          text,
  cout_ht         numeric(10,2),
  notes           text,
  created_at      timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  8. DOSSIERS
-- ──────────────────────────────────────────────
create table dossiers (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  numero        text not null,               -- DOS-2026-001, généré auto
  client_id     uuid not null references clients(id) on delete restrict,
  date_debut    date not null,
  date_fin      date not null,
  nb_jours      integer not null generated always as
                  (date_fin - date_debut + 1) stored,
  statut        text not null default 'en_attente'
                check (statut in ('brouillon','en_attente','confirme','en_cours','termine','annule')),
  montant_ht    numeric(12,2) not null default 0,
  montant_tva   numeric(12,2) not null default 0,
  montant_ttc   numeric(12,2) not null default 0,
  notes         text,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(company_id, numero)
);

-- ──────────────────────────────────────────────
--  9. PRESTATIONS
-- ──────────────────────────────────────────────
create table prestations (
  id                    uuid primary key default uuid_generate_v4(),
  company_id            uuid not null references companies(id) on delete cascade,
  dossier_id            uuid not null references dossiers(id) on delete cascade,
  ordre                 integer not null default 1,
  type                  text not null check (type in ('mad','transfert')),
  statut                text not null default 'en_attente'
                        check (statut in ('en_attente','confirme','en_cours','termine','annule')),
  date_debut            date not null,
  date_fin              date not null,
  nb_jours              integer not null generated always as
                          (date_fin - date_debut + 1) stored,
  -- Transfert
  heure_depart          time,
  adresse_depart        text,
  adresse_arrivee       text,
  -- MAD
  heure_debut_journee   time,
  heure_fin_journee     time,
  -- Tarification
  tarif_journalier_ht   numeric(10,2),
  tarif_fixe_ht         numeric(10,2),
  montant_ht            numeric(12,2) not null default 0,
  -- Véhicule
  modele_souhaite       text,
  vehicule_id           uuid references vehicules(id) on delete set null,
  vehicule_ext_id       uuid references vehicules_ext(id) on delete set null,
  affectation_differee  boolean not null default false,
  -- Chauffeur (transfert ponctuel)
  chauffeur_id          uuid references chauffeurs(id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now()
);

-- ──────────────────────────────────────────────
--  10. JOURS MAD
-- ──────────────────────────────────────────────
create table jours_mad (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(id) on delete cascade,
  prestation_id    uuid not null references prestations(id) on delete cascade,
  date             date not null,
  jour_semaine     text not null,           -- Lun, Mar, Mer...
  chauffeur_id     uuid references chauffeurs(id) on delete set null,
  vehicule_id      uuid references vehicules(id) on delete set null,
  vehicule_ext_id  uuid references vehicules_ext(id) on delete set null,
  tarif_ht         numeric(10,2) not null default 0,
  note             text,
  statut           text not null default 'en_attente'
                   check (statut in ('en_attente','confirme','termine')),
  created_at       timestamptz not null default now(),
  unique(prestation_id, date)
);

-- ──────────────────────────────────────────────
--  11. FACTURES
-- ──────────────────────────────────────────────
create table factures (
  id              uuid primary key default uuid_generate_v4(),
  company_id      uuid not null references companies(id) on delete cascade,
  numero          text not null,            -- FAC-2026-001
  dossier_id      uuid references dossiers(id) on delete set null,
  client_id       uuid not null references clients(id) on delete restrict,
  statut          text not null default 'brouillon'
                  check (statut in ('brouillon','emise','envoyee','payee','en_retard','annulee')),
  date_emission   date not null default current_date,
  date_echeance   date not null,
  montant_ht      numeric(12,2) not null default 0,
  taux_tva        numeric(5,2) not null default 10,
  montant_tva     numeric(12,2) not null default 0,
  montant_ttc     numeric(12,2) not null default 0,
  notes           text,
  pdf_url         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(company_id, numero)
);

-- ──────────────────────────────────────────────
--  12. LIGNES DE FACTURE
-- ──────────────────────────────────────────────
create table lignes_facture (
  id               uuid primary key default uuid_generate_v4(),
  facture_id       uuid not null references factures(id) on delete cascade,
  ordre            integer not null default 1,
  designation      text not null,
  description      text,
  reference        text,
  quantite         numeric(8,2) not null default 1,
  prix_unitaire_ht numeric(10,2) not null,
  montant_ht       numeric(12,2) not null generated always as
                     (quantite * prix_unitaire_ht) stored,
  created_at       timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
--  FONCTIONS UTILITAIRES
-- ═══════════════════════════════════════════════════════════════

-- Génère le prochain numéro de dossier pour une société
create or replace function next_dossier_numero(p_company_id uuid)
returns text language plpgsql as $$
declare
  v_year  text := to_char(current_date, 'YYYY');
  v_count integer;
begin
  select count(*) into v_count
  from dossiers
  where company_id = p_company_id
    and to_char(created_at, 'YYYY') = v_year;
  return 'DOS-' || v_year || '-' || lpad((v_count + 1)::text, 3, '0');
end;
$$;

-- Génère le prochain numéro de facture
create or replace function next_facture_numero(p_company_id uuid)
returns text language plpgsql as $$
declare
  v_year  text := to_char(current_date, 'YYYY');
  v_count integer;
begin
  select count(*) into v_count
  from factures
  where company_id = p_company_id
    and to_char(created_at, 'YYYY') = v_year;
  return 'FAC-' || v_year || '-' || lpad((v_count + 1)::text, 3, '0');
end;
$$;

-- Recalcule les montants d'un dossier depuis ses prestations
create or replace function recalc_dossier(p_dossier_id uuid)
returns void language plpgsql as $$
declare
  v_ht    numeric(12,2);
  v_tva   numeric(12,2);
begin
  select coalesce(sum(montant_ht), 0) into v_ht
  from prestations
  where dossier_id = p_dossier_id
    and statut != 'annule';

  v_tva := round(v_ht * 0.10, 2);

  update dossiers set
    montant_ht  = v_ht,
    montant_tva = v_tva,
    montant_ttc = v_ht + v_tva,
    updated_at  = now()
  where id = p_dossier_id;
end;
$$;

-- Recalcule le montant d'une prestation MAD depuis ses jours
create or replace function recalc_prestation_mad(p_prestation_id uuid)
returns void language plpgsql as $$
declare
  v_ht numeric(12,2);
  v_dossier_id uuid;
begin
  select coalesce(sum(tarif_ht), 0) into v_ht
  from jours_mad
  where prestation_id = p_prestation_id;

  update prestations set montant_ht = v_ht
  where id = p_prestation_id
  returning dossier_id into v_dossier_id;

  perform recalc_dossier(v_dossier_id);
end;
$$;

-- Trigger: updated_at automatique
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger dossiers_updated_at
  before update on dossiers
  for each row execute function set_updated_at();

create trigger factures_updated_at
  before update on factures
  for each row execute function set_updated_at();

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  Chaque utilisateur ne voit que les données de sa société
-- ═══════════════════════════════════════════════════════════════

-- Helper: récupère le company_id de l'utilisateur connecté
create or replace function my_company_id()
returns uuid language sql stable as $$
  select company_id from profiles where id = auth.uid()
$$;

-- Helper: récupère le rôle de l'utilisateur connecté
create or replace function my_role()
returns text language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- Activer RLS sur toutes les tables
alter table companies       enable row level security;
alter table profiles        enable row level security;
alter table clients         enable row level security;
alter table chauffeurs      enable row level security;
alter table sous_traitants  enable row level security;
alter table vehicules       enable row level security;
alter table vehicules_ext   enable row level security;
alter table dossiers        enable row level security;
alter table prestations     enable row level security;
alter table jours_mad       enable row level security;
alter table factures        enable row level security;
alter table lignes_facture  enable row level security;

-- Politique générique: voir sa société
create policy "company_isolation" on companies
  for select using (id = my_company_id());

-- Politique générique pour toutes les tables avec company_id
-- (SELECT, INSERT, UPDATE, DELETE filtrés par company_id)

-- profiles
create policy "profiles_select" on profiles for select using (company_id = my_company_id());
create policy "profiles_insert" on profiles for insert with check (company_id = my_company_id());
create policy "profiles_update" on profiles for update using (company_id = my_company_id());

-- clients
create policy "clients_all" on clients for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- chauffeurs
create policy "chauffeurs_all" on chauffeurs for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- sous_traitants
create policy "st_all" on sous_traitants for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- vehicules
create policy "vehicules_all" on vehicules for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- vehicules_ext
create policy "vehicules_ext_all" on vehicules_ext for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- dossiers
create policy "dossiers_all" on dossiers for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- prestations
create policy "prestations_all" on prestations for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- jours_mad
create policy "jours_mad_all" on jours_mad for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- factures
create policy "factures_all" on factures for all using (company_id = my_company_id())
  with check (company_id = my_company_id());

-- lignes_facture (via facture)
create policy "lignes_facture_all" on lignes_facture
  for all using (
    exists (
      select 1 from factures f
      where f.id = facture_id
        and f.company_id = my_company_id()
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  INDEXES (performances)
-- ═══════════════════════════════════════════════════════════════

create index idx_profiles_company       on profiles(company_id);
create index idx_clients_company        on clients(company_id);
create index idx_chauffeurs_company     on chauffeurs(company_id);
create index idx_vehicules_company      on vehicules(company_id);
create index idx_dossiers_company       on dossiers(company_id);
create index idx_dossiers_client        on dossiers(client_id);
create index idx_dossiers_dates         on dossiers(date_debut, date_fin);
create index idx_dossiers_statut        on dossiers(statut);
create index idx_prestations_dossier    on prestations(dossier_id);
create index idx_prestations_dates      on prestations(date_debut, date_fin);
create index idx_jours_mad_prestation   on jours_mad(prestation_id);
create index idx_jours_mad_date         on jours_mad(date);
create index idx_jours_mad_chauffeur    on jours_mad(chauffeur_id);
create index idx_factures_company       on factures(company_id);
create index idx_factures_dossier       on factures(dossier_id);
create index idx_lignes_facture_facture on lignes_facture(facture_id);

-- ═══════════════════════════════════════════════════════════════
--  DONNÉES DE DÉMO (à supprimer en production)
-- ═══════════════════════════════════════════════════════════════

-- Insérer une société de démo
insert into companies (id, nom, slug, plan) values
  ('00000000-0000-0000-0000-000000000001', 'Élite Drive', 'elite-drive', 'pro');
