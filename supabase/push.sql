-- Schritt 7: Tabellen für Push-Erinnerungen
-- Im Dashboard unter "SQL Editor" einfügen und mit "Run" ausführen.

-- 1) Wohin darf der Server Nachrichten schicken? Eine Zeile pro Gerät (Push-Adresse von Apple/Google).
--    tz = Zeitzone des Geräts, damit "08:30" auch auf Reisen 08:30 Ortszeit bedeutet.
create table public.push_subscriptions (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,          -- Schlüsselteil für die Verschlüsselung der Nachricht
  auth       text not null,          -- Geheimnis des Geräts für diese Adresse
  tz         text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

-- 2) Merkzettel: Erinnerung für diesen Habit an diesem Tag wurde schon verschickt (verhindert Doppelte).
create table public.reminders_sent (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  habit_id text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, day, habit_id)
);

-- 3) Rechte
-- Die App (eingeloggt) darf nur ihre eigenen Push-Adressen verwalten.
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Die Serverfunktion läuft als "service_role". Weil "Automatically expose new tables" aus ist,
-- bekommt sie ihre Rechte ebenfalls nur durch ausdrückliches GRANT.
grant select, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.reminders_sent to service_role;
grant select on public.habits, public.logs to service_role;

-- 4) Row Level Security
alter table public.push_subscriptions enable row level security;
alter table public.reminders_sent     enable row level security;

create policy "eigene push-adressen" on public.push_subscriptions
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- reminders_sent bekommt absichtlich KEINE Regel für "authenticated": Die App kommt nie heran,
-- nur der Server (service_role umgeht RLS).
