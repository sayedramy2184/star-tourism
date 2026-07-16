-- Migration 011 — Gestion du parc & location des véhicules
-- Les véhicules sont souvent loués AUPRÈS de loueurs (LLD / leasing / location).
-- Le loyer peut être au jour, à la semaine ou au mois → loyer_ht + loyer_periode.

alter table vehicules
  add column if not exists mode_acquisition text not null default 'propriete',
  add column if not exists loueur           text,
  add column if not exists loyer_ht         numeric(10,2),
  add column if not exists loyer_periode    text not null default 'mois',
  add column if not exists depot_garantie   numeric(10,2),
  add column if not exists km_inclus        integer,
  add column if not exists cout_km_sup      numeric(10,2),
  add column if not exists contrat_debut    date,
  add column if not exists contrat_fin      date,
  add column if not exists date_entree_parc date,
  add column if not exists date_sortie_parc date;

-- Compat : si une version antérieure de cette migration a créé loyer_mensuel_ht,
-- on récupère ses valeurs dans loyer_ht puis on supprime l'ancienne colonne.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'vehicules' and column_name = 'loyer_mensuel_ht'
  ) then
    update vehicules set loyer_ht = coalesce(loyer_ht, loyer_mensuel_ht);
    alter table vehicules drop column loyer_mensuel_ht;
  end if;
end $$;

-- Modes : propriete = à nous | lld = longue durée | leasing = leasing/LOA | location = location courte
alter table vehicules drop constraint if exists vehicules_mode_acquisition_check;
alter table vehicules add constraint vehicules_mode_acquisition_check
  check (mode_acquisition in ('propriete','lld','leasing','location'));

-- Période du loyer : jour | semaine | mois
alter table vehicules drop constraint if exists vehicules_loyer_periode_check;
alter table vehicules add constraint vehicules_loyer_periode_check
  check (loyer_periode in ('jour','semaine','mois'));

create index if not exists idx_vehicules_mode   on vehicules(mode_acquisition);
create index if not exists idx_vehicules_contrat on vehicules(contrat_fin);
