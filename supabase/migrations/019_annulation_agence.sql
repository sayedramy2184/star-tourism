-- ══════════════════════════════════════════════════════════════
--  Migration 019 — Demande d'annulation par l'agence
--
--  L'agence peut demander l'annulation d'un service ; le dispatch la
--  confirme (statut = 'annule') ou la refuse. Une fois confirmée, le
--  service n'apparaît plus côté agence.
--  Idempotente.
-- ══════════════════════════════════════════════════════════════

alter table prestations
  add column if not exists annulation_demandee boolean not null default false;
