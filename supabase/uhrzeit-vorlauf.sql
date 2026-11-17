-- Uhrzeit + Vorlauf statt fester Erinnerungszeit
-- Im Dashboard unter "SQL Editor" einfügen und mit "Run" ausführen. ZUERST ausführen, dann die Funktion
-- aktualisieren, danach erst die neue App-Version hochladen.
--
-- Vorher:  remind = Zeitpunkt der Erinnerung.
-- Jetzt:   at_time       = Uhrzeit des Habits ("wann machst du das?")
--          remind_before = Minuten vorher erinnern (0 = zur Uhrzeit, NULL = keine Erinnerung)

alter table public.habits
  add column at_time       time,
  add column remind_before int check (remind_before is null or remind_before between 0 and 20160);

-- Bestehende Erinnerungen übernehmen: die alte Zeit wird zur Uhrzeit, Erinnerung zur Uhrzeit (0 Minuten vorher).
-- So kommen deine Erinnerungen weiterhin zur selben Minute wie bisher.
update public.habits
   set at_time = remind, remind_before = 0
 where remind is not null and at_time is null;

-- Die alte Spalte "remind" bleibt vorerst bestehen, damit eine noch nicht aktualisierte App nichts kaputt macht.
-- Die neue App schreibt dort NULL. Später kann sie mit  alter table public.habits drop column remind;  entfernt werden.
-- Rechte und RLS gelten tabellenweit, du musst für die neuen Spalten nichts zusätzlich freigeben.

-- Hast du diese Datei schon einmal mit der alten Grenze (24 Stunden) ausgeführt? Dann nur noch das hier ausführen:
--   alter table public.habits drop constraint habits_remind_before_check;
--   alter table public.habits add constraint habits_remind_before_check
--     check (remind_before is null or remind_before between 0 and 20160);   -- 20160 Minuten = 14 Tage
