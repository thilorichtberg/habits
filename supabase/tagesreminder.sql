-- Tägliche Sammel-Erinnerung (Standard: jeden Tag um 20:00, wenn noch Habits offen sind)
-- Im Dashboard unter "SQL Editor" ausführen. Muss vor dem Deployen der neuen Funktion laufen.
--
-- Pro Nutzer eine Zeile. Gibt es keine Zeile, gilt der Standard (an, 20:00). Die Zeitzone kommt vom Gerät
-- (push_subscriptions.tz), die Uhrzeit gilt also in deiner Ortszeit.

create table public.user_settings (
  user_id       uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  daily_enabled boolean not null default true,
  daily_time    time not null default '20:00',
  updated_at    timestamptz not null default now()
);

grant select, insert, update, delete on public.user_settings to authenticated;
grant select on public.user_settings to service_role;   -- die Serverfunktion liest die Einstellungen
alter table public.user_settings enable row level security;

create policy "eigene einstellungen" on public.user_settings
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
