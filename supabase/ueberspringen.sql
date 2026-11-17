-- Habits überspringen (mit Grund)
-- Im Dashboard unter "SQL Editor" einfügen und mit "Run" ausführen. ZUERST ausführen, dann die Funktion
-- aktualisieren, danach erst die neue App-Version hochladen.
--
-- Zählstand und Grund eines Tages teilen sich eine Zeile in "logs":
--   skip = NULL      → nicht übersprungen
--   skip = 'sick'    → Krankheit (zählt nicht zur Quote)
--   skip = 'vacation' | 'time' | 'other' → übersprungen, zählt als nicht geschafft

alter table public.logs
  add column skip text check (skip is null or char_length(skip) <= 20);

-- Rechte und RLS gelten tabellenweit, für die neue Spalte ist nichts zusätzlich freizugeben.
