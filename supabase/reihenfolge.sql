-- Eigene Reihenfolge für Gewohnheiten und Aufgaben (kleinere Zahl = weiter oben, null = noch nicht einsortiert, kommt ganz unten)
-- Im Dashboard unter "SQL Editor" ausführen, BEVOR die App mit Verschieben veröffentlicht wird.
alter table public.habits add column if not exists sort_pos integer;
alter table public.todos  add column if not exists sort_pos integer;
