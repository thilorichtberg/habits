-- Habit Tracker: Schema für Supabase (Schritt 2 + 3)
-- Im Dashboard unter "SQL Editor" einfügen und mit "Run" ausführen.

-- 1) Tabellen -----------------------------------------------------------
-- user_id wird beim Einfügen automatisch mit der ID des eingeloggten Nutzers gefüllt (auth.uid()).
-- Der Primärschlüssel besteht aus (user_id, id): Die App erzeugt die Habit-IDs selbst,
-- so können sich IDs verschiedener Nutzer nie in die Quere kommen.

create table public.habits (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null,
  name       text not null check (char_length(name) between 1 and 40),
  target     int  not null default 1 check (target between 1 and 99),
  days       int[] not null default '{0,1,2,3,4,5,6}',   -- JS-Wochentage: 0 = Sonntag
  remind     time,                                        -- optional: Erinnerungszeit
  created    date not null,
  archived   date,                                        -- gesetzt = gelöscht (Historie bleibt)
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.logs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  habit_id   text not null,
  count      int  not null check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, habit_id),
  foreign key (user_id, habit_id) references public.habits (user_id, id) on delete cascade
);

-- 2) Rechte (GRANT): Darf die Rolle die Tabelle überhaupt ansprechen? ------
-- "authenticated" = eingeloggte Nutzer. "anon" (nicht eingeloggt) bekommt bewusst nichts.
grant select, insert, update, delete on public.habits, public.logs to authenticated;

-- 3) Row Level Security (RLS): Welche ZEILEN darf man sehen/ändern? ----------
alter table public.habits enable row level security;
alter table public.logs   enable row level security;

create policy "eigene habits" on public.habits
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "eigene logs" on public.logs
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
