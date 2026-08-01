-- ─────────────────────────────────────────────
--  023 — Versements aux chauffeurs (paie)
--  Décompte du salaire (calculé côté app : 200 €/jour MAD, 50 €/transfert)
--  − versements enregistrés = restant dû.
--  Même modèle que paiements_sous_traitant (013) / paiements_loueur (012).
-- ─────────────────────────────────────────────
create table if not exists paiements_chauffeur (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references companies(id) on delete cascade,
  chauffeur_id  uuid not null references chauffeurs(id) on delete cascade,
  montant       numeric(10,2) not null,
  date_paiement date not null default current_date,
  moyen         text,   -- virement | especes | cheque | carte | autre
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_paiements_chauffeur on paiements_chauffeur(chauffeur_id);

alter table paiements_chauffeur enable row level security;
drop policy if exists "paiements_chauffeur_all" on paiements_chauffeur;
create policy "paiements_chauffeur_all" on paiements_chauffeur
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
