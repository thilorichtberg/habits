-- Beschreibungen für Gewohnheiten und Aufgaben (optional, bis 500 Zeichen)
-- Im Dashboard unter "SQL Editor" ausführen, BEVOR die App mit Beschreibungen veröffentlicht wird.
alter table public.habits add column if not exists description text check (char_length(description) <= 500);
alter table public.todos  add column if not exists description text check (char_length(description) <= 500);
