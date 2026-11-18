-- To-Do "Woche": Aufgaben bekommen optional Tag, Uhrzeit und Erinnerung (wie bei den Habits)
--   due_day       Tag der Aufgabe (null = ohne Tag, dann gilt weiter Heute/Später)
--   at_time       Uhrzeit (optional)
--   remind_before Minuten vor Tag+Uhrzeit (0 bis 14 Tage), null = keine Erinnerung
-- Im Dashboard unter "SQL Editor" ausführen, BEVOR die App mit der Wochenansicht veröffentlicht wird.
alter table public.todos add column if not exists due_day date;
alter table public.todos add column if not exists at_time time;
alter table public.todos add column if not exists remind_before integer
  check (remind_before is null or (remind_before >= 0 and remind_before <= 20160));

-- Die Serverfunktion (service_role) liest die Aufgaben für die Erinnerungen
grant select on public.todos to service_role;

create index if not exists todos_remind_idx on public.todos (user_id, due_day)
  where remind_before is not null and not done and not deleted;
