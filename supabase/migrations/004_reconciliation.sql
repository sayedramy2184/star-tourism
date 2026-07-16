-- ═══════════════════════════════════════════════════════════════
--  ÉLITE DRIVE — Migration 004 — Réconciliation code ↔ schéma
--  Idempotente. Rend une base neuve 100 % compatible avec src/.
--  (Comble les colonnes/tables/RPC/triggers attendus par le code
--   mais issus de migrations 002–005 jamais commitées.)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Forfaits MAD ────────────────────────────
create table if not exists forfaits_mad (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(id) on delete cascade,
  nom              text not null,
  heures_incluses  numeric(6,2) not null default 0,
  tarif_ht         numeric(10,2) not null default 0,
  tarif_heure_sup  numeric(10,2) not null default 0,
  avec_heures_sup  boolean not null default true,
  notes            text,
  actif            boolean not null default true,
  created_at       timestamptz not null default now()
);
create index if not exists idx_forfaits_mad_company on forfaits_mad(company_id);

alter table forfaits_mad enable row level security;
drop policy if exists "forfaits_mad_all" on forfaits_mad;
create policy "forfaits_mad_all" on forfaits_mad
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());

-- ── 2. Dossiers — validation ───────────────────
alter table dossiers
  add column if not exists valide_at timestamptz,
  add column if not exists valide_by uuid references profiles(id) on delete set null;

-- ── 3. Jours MAD — forfaits & heures réelles ───
alter table jours_mad
  add column if not exists forfait_id         uuid references forfaits_mad(id) on delete set null,
  add column if not exists heures_incluses    numeric(6,2),
  add column if not exists tarif_heure_sup    numeric(10,2),
  add column if not exists heure_debut_reelle time,
  add column if not exists heure_fin_reelle   time,
  add column if not exists heures_reelles     numeric(6,2),
  add column if not exists heures_sup         numeric(6,2),
  add column if not exists montant_sup        numeric(10,2),
  add column if not exists montant_total      numeric(12,2);
create index if not exists idx_jours_mad_forfait on jours_mad(forfait_id);

-- ── 4. RPC update_jour_mad_montant (manquante) ─
--  Recalcule heures réelles / sup / montant total d'un jour MAD.
create or replace function update_jour_mad_montant(p_jour_id uuid)
returns void language plpgsql as $$
declare
  v_debut time; v_fin time;
  v_incluses numeric(6,2); v_tarifsup numeric(10,2); v_base numeric(12,2);
  v_reelles numeric(6,2); v_sup numeric(6,2); v_msup numeric(10,2);
begin
  select j.heure_debut_reelle, j.heure_fin_reelle,
         coalesce(j.heures_incluses, f.heures_incluses, 0),
         coalesce(j.tarif_heure_sup, f.tarif_heure_sup, 0),
         coalesce(f.tarif_ht, j.tarif_ht, 0)
    into v_debut, v_fin, v_incluses, v_tarifsup, v_base
  from jours_mad j
  left join forfaits_mad f on f.id = j.forfait_id
  where j.id = p_jour_id;

  if v_debut is null or v_fin is null then
    update jours_mad set heures_reelles = null, heures_sup = 0,
           montant_sup = 0, montant_total = coalesce(v_base, tarif_ht)
     where id = p_jour_id;
    return;
  end if;

  v_reelles := round(extract(epoch from (v_fin - v_debut)) / 3600.0
                     + case when v_fin < v_debut then 24 else 0 end, 2);
  v_sup  := greatest(0, v_reelles - v_incluses);
  v_msup := round(v_sup * v_tarifsup, 2);

  update jours_mad set
    heures_reelles = v_reelles, heures_sup = v_sup,
    montant_sup = v_msup, montant_total = round(v_base + v_msup, 2)
  where id = p_jour_id;
end;
$$;

-- ── 5. recalc_prestation_mad — inclut les heures sup ──
create or replace function recalc_prestation_mad(p_prestation_id uuid)
returns void language plpgsql as $$
declare
  v_ht numeric(12,2);
  v_dossier_id uuid;
begin
  select coalesce(sum(coalesce(montant_total, tarif_ht)), 0) into v_ht
  from jours_mad where prestation_id = p_prestation_id;

  update prestations set montant_ht = v_ht
  where id = p_prestation_id
  returning dossier_id into v_dossier_id;

  perform recalc_dossier(v_dossier_id);
end;
$$;

-- ── 6. Trigger auto : dossier → termine ────────
--  Passe le dossier à « termine » quand toutes ses prestations sont
--  termine/annule ; le rouvre à « en_cours » si l'une redevient active.
create or replace function sync_dossier_statut()
returns trigger language plpgsql as $$
declare
  v_dossier_id uuid := coalesce(new.dossier_id, old.dossier_id);
  v_total integer; v_closes integer; v_statut text;
begin
  if v_dossier_id is null then return coalesce(new, old); end if;

  select statut into v_statut from dossiers where id = v_dossier_id;
  if v_statut not in ('en_cours','termine') then
    return coalesce(new, old);
  end if;

  select count(*), count(*) filter (where statut in ('termine','annule'))
    into v_total, v_closes
  from prestations where dossier_id = v_dossier_id;

  if v_total > 0 and v_closes = v_total then
    update dossiers set statut = 'termine', updated_at = now()
     where id = v_dossier_id and statut <> 'termine';
  else
    update dossiers set statut = 'en_cours', updated_at = now()
     where id = v_dossier_id and statut = 'termine';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists prestations_sync_dossier on prestations;
create trigger prestations_sync_dossier
  after insert or update of statut or delete on prestations
  for each row execute function sync_dossier_statut();
