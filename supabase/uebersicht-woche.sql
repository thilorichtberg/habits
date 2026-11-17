-- Übersicht: Auswahl der Gewohnheiten für die 7-Tage-Tabelle (bis zu 10, Reihenfolge = Reihenfolge der Auswahl)
-- Im Dashboard unter "SQL Editor" ausführen. Null = noch nie gewählt, die App zeigt dann die ersten 10.
alter table public.user_settings add column if not exists week_habits jsonb;
