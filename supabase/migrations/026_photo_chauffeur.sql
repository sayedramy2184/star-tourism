-- ─────────────────────────────────────────────
--  026 — Photo du chauffeur
--  Colonne photo_path (chemin dans le bucket public 'chauffeur-photos')
--  + bucket de stockage public (lecture directe via URL publique).
-- ─────────────────────────────────────────────
alter table chauffeurs add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('chauffeur-photos', 'chauffeur-photos', true)
on conflict (id) do nothing;
