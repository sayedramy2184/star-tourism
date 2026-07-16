-- ═══════════════════════════════════════════════════════════════
--  ÉLITE DRIVE — Migration 005 — Facturation professionnelle
--  Numérotation légale (séquence sans réutilisation), paiements,
--  avoirs. Idempotente.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Compteurs de numérotation (séquence continue par société/année) ──
create table if not exists compteurs (
  company_id  uuid    not null references companies(id) on delete cascade,
  type        text    not null,       -- 'facture', 'avoir', 'dossier'…
  annee       integer not null,
  last_value  integer not null default 0,
  primary key (company_id, type, annee)
);
alter table compteurs enable row level security;
-- Accès direct interdit aux clients ; la numérotation passe par next_numero() (SECURITY DEFINER).

create or replace function next_numero(p_company_id uuid, p_type text, p_prefix text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year integer := extract(year from current_date)::int;
  v_val  integer;
begin
  insert into compteurs (company_id, type, annee, last_value)
  values (p_company_id, p_type, v_year, 1)
  on conflict (company_id, type, annee)
  do update set last_value = compteurs.last_value + 1
  returning last_value into v_val;
  return p_prefix || '-' || v_year || '-' || lpad(v_val::text, 3, '0');
end;
$$;

-- ── 2. Factures : type (facture/avoir) + lien vers la facture d'origine ──
alter table factures
  add column if not exists type text not null default 'facture'
    check (type in ('facture','avoir')),
  add column if not exists facture_origine_id uuid references factures(id) on delete set null;

-- ── 3. Paiements ───────────────────────────────
create table if not exists paiements (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  facture_id    uuid not null references factures(id) on delete cascade,
  montant       numeric(12,2) not null,
  date_paiement date not null default current_date,
  moyen         text,       -- virement, cb, especes, cheque, autre
  reference     text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_paiements_facture on paiements(facture_id);
create index if not exists idx_paiements_company on paiements(company_id);

alter table paiements enable row level security;
drop policy if exists "paiements_all" on paiements;
create policy "paiements_all" on paiements
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
