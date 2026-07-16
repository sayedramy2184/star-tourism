-- ──────────────────────────────────────────────
--  ÉLITE DRIVE — Migration 003
--  Documents officiels (contrôle routier) dans l'espace chauffeur
--
--  - Champs société : gérant + chemins Storage des documents
--  - Bucket Storage privé pour les documents société
-- ──────────────────────────────────────────────

-- ── Table paramètres société (créée ici si absente, pour un déploiement neuf) ──
create table if not exists societe_parametres (
  id                          uuid primary key default uuid_generate_v4(),
  company_id                  uuid not null references companies(id) on delete cascade,
  nom                         text,
  forme_juridique             text,
  siret                       text,
  numero_tva                  text,
  adresse                     text,
  code_postal                 text,
  ville                       text,
  pays                        text,
  telephone                   text,
  email                       text,
  site_web                    text,
  iban                        text,
  bic                         text,
  banque                      text,
  taux_tva                    numeric(5,2) not null default 10,
  conditions_paiement         text default 'Paiement à 30 jours',
  mentions_legales            text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'societe_parametres_company_id_key') then
    alter table societe_parametres add constraint societe_parametres_company_id_key unique (company_id);
  end if;
end $$;

alter table societe_parametres enable row level security;
drop policy if exists "societe_parametres_all" on societe_parametres;
create policy "societe_parametres_all" on societe_parametres
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());

drop trigger if exists societe_parametres_updated_at on societe_parametres;
create trigger societe_parametres_updated_at
  before update on societe_parametres
  for each row execute function set_updated_at();

-- ── Champs société (documents officiels) ───────
alter table societe_parametres
  add column if not exists gerant_nom                  text,
  add column if not exists signature_path              text,   -- signature / tampon (image)
  add column if not exists attestation_assurance_path  text,   -- PDF ou image
  add column if not exists licence_evtc_path           text;   -- PDF ou image

-- ── Bucket Storage privé ───────────────────────
insert into storage.buckets (id, name, public)
values ('societe-docs', 'societe-docs', false)
on conflict (id) do nothing;
