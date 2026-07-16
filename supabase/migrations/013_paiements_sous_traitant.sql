-- Migration 013 — Paiements aux sous-traitants (même principe que les loueurs)
-- Décompte = somme des coûts ST des prestations. Les versements libres déduisent la dette.

create table if not exists paiements_sous_traitant (
  id               uuid primary key default uuid_generate_v4(),
  company_id       uuid not null references companies(id) on delete cascade,
  sous_traitant_id uuid not null references sous_traitants(id) on delete cascade,
  montant          numeric(10,2) not null,
  date_paiement    date not null default current_date,
  moyen            text,   -- virement | especes | cheque | carte | autre
  note             text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_paiements_st on paiements_sous_traitant(sous_traitant_id);
alter table paiements_sous_traitant enable row level security;
drop policy if exists "paiements_sous_traitant_all" on paiements_sous_traitant;
create policy "paiements_sous_traitant_all" on paiements_sous_traitant
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
