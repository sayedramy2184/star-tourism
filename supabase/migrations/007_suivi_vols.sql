-- ═══════════════════════════════════════════════════════════════
--  STAR TOURISM SERVICES — Migration 007 — Suivi vols / trains
--  Champs de suivi pour les transferts aéroport / gare.
--  Idempotente.
-- ═══════════════════════════════════════════════════════════════

alter table prestations
  add column if not exists vol_numero    text,   -- n° de vol ou de train (ex. EY031, TRAIN 9012)
  add column if not exists vol_heure      time,   -- heure programmée d'arrivée/départ
  add column if not exists vol_ville      text,   -- provenance (arrivée) ou destination (départ)
  add column if not exists vol_terminal   text,   -- terminal / gare (ex. CDG 1, 2E)
  add column if not exists vol_arrivee     boolean; -- true = arrivée « de », false = départ « pour »
