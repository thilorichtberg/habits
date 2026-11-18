-- Überspringen mit eigenem Grund: "Sonstiges" kann einen Freitext tragen, gespeichert als 'other:Freitext' (Freitext bis 80 Zeichen)
-- Im Dashboard unter "SQL Editor" ausführen, BEVOR die App mit dem Textfeld veröffentlicht wird.
alter table public.logs drop constraint if exists logs_skip_check;
alter table public.logs add constraint logs_skip_check check (skip is null or char_length(skip) <= 120);
