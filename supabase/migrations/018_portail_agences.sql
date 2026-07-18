-- ══════════════════════════════════════════════════════════════
--  Migration 018 — Portail AGENCES (soumission + suivi)
--
--  - Lien fiche client (type 'agence') ↔ compte auth (profile_id)
--  - Nouveau rôle 'agence'
--  - Dossiers : origine (interne | agence) + soumis_at
--  - Prestations : validation_statut (a_valider | validee | refusee) + refus_motif
--  - RLS RESTRICTIVE : un compte agence n'accède QU'À ses propres dossiers,
--    prestations, passagers, factures. Tout le reste est interdit.
--  Idempotente.
-- ══════════════════════════════════════════════════════════════

-- ── 1. Lien compte de connexion (sur clients) ──
alter table clients
  add column if not exists profile_id uuid references profiles(id) on delete set null;
create unique index if not exists idx_clients_profile
  on clients(profile_id) where profile_id is not null;

-- ── 2. Rôle 'agence' ───────────────────────────
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute 'alter table profiles drop constraint ' || quote_ident(c.conname);
  end loop;
end $$;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','dispatcher','chauffeur','sous_traitant','agence'));

-- ── 3. Soumission & validation ─────────────────
alter table dossiers
  add column if not exists origine   text not null default 'interne',
  add column if not exists soumis_at timestamptz;
alter table dossiers drop constraint if exists dossiers_origine_check;
alter table dossiers add constraint dossiers_origine_check check (origine in ('interne','agence'));

alter table prestations
  add column if not exists validation_statut text not null default 'validee',
  add column if not exists refus_motif        text;
alter table prestations drop constraint if exists prestations_validation_check;
alter table prestations add constraint prestations_validation_check
  check (validation_statut in ('a_valider','validee','refusee'));

-- ── 4. Helpers (SECURITY DEFINER) ──────────────
create or replace function my_agence_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from clients where profile_id = auth.uid() and type = 'agence'
$$;

create or replace function agence_can_see_dossier(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from dossiers d where d.id = d_id and d.client_id = my_agence_id())
$$;

-- ── 5. Politiques RESTRICTIVES pour le rôle 'agence' ──
-- Neutres (passent) pour tout rôle ≠ agence.

drop policy if exists "ag_scope_clients" on clients;
create policy "ag_scope_clients" on clients as restrictive for all
  using  (my_role() is distinct from 'agence' or id = my_agence_id())
  with check (my_role() is distinct from 'agence' or id = my_agence_id());

drop policy if exists "ag_scope_dossiers" on dossiers;
create policy "ag_scope_dossiers" on dossiers as restrictive for all
  using  (my_role() is distinct from 'agence' or client_id = my_agence_id())
  with check (my_role() is distinct from 'agence' or client_id = my_agence_id());

drop policy if exists "ag_scope_prestations" on prestations;
create policy "ag_scope_prestations" on prestations as restrictive for all
  using  (my_role() is distinct from 'agence' or agence_can_see_dossier(dossier_id))
  with check (my_role() is distinct from 'agence' or agence_can_see_dossier(dossier_id));

drop policy if exists "ag_scope_passagers" on passagers;
create policy "ag_scope_passagers" on passagers as restrictive for all
  using  (my_role() is distinct from 'agence' or agence_can_see_dossier(dossier_id))
  with check (my_role() is distinct from 'agence' or agence_can_see_dossier(dossier_id));

do $$
begin
  if to_regclass('public.factures') is not null then
    execute 'drop policy if exists "ag_scope_factures" on factures';
    execute 'create policy "ag_scope_factures" on factures as restrictive for all
      using (my_role() is distinct from ''agence'' or client_id = my_agence_id())';
  end if;
end $$;

-- ── 6. Tout le reste : INTERDIT pour une agence ──
do $$
declare t text;
begin
  foreach t in array array[
    'chauffeurs','vehicules','vehicules_ext','jours_mad','sous_traitants',
    'lignes_facture','compteurs','paiements','tarifs_clients','forfaits_mad',
    'loueurs','paiements_loueur','paiements_sous_traitant','societe_parametres'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on %I', 'ag_block_' || t, t);
      execute format(
        'create policy %I on %I as restrictive for all using (my_role() is distinct from ''agence'')',
        'ag_block_' || t, t
      );
    end if;
  end loop;
end $$;
